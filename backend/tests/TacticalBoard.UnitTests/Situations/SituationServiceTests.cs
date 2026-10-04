using System.Text.Json;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Situations;

public class SituationServiceTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly AreaReference AlicesArea = AreaReference.Personal(Alice);

    private readonly InMemorySituationRepository _repository = new();
    private readonly FakeAreaAccess _areas = new(Alice);
    private readonly FakeActorDirectory _actors = new(Alice) { Names = { [Alice] = "Alice", [Bob] = "Bob" } };
    private readonly FixedClock _clock = new(new DateTimeOffset(2026, 10, 4, 8, 0, 0, TimeSpan.Zero).AddTicks(12_345_678));

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private readonly SequenceIdGenerator _ids = new();

    private SituationService Service => new(_repository, _areas, _actors, _ids, _clock);

    private static SituationTitle Title(string text)
    {
        Assert.True(SituationTitle.TryCreate(text, out var title, out _));
        return title;
    }

    private Task<SituationView> CreateAsync(string title, SituationOrigin origin = SituationOrigin.New, string fieldType = "full") =>
        Service.CreateAsync(AlicesArea, Title(title), SituationDocuments.Valid(title, fieldType), origin, Cancellation);

    private static string DocumentTitle(SituationView view) =>
        JsonDocument.Parse(view.Document).RootElement.GetProperty("situation").GetProperty("title").GetString()!;

    [Fact]
    public async Task Creates_a_situation_at_the_top_level_of_the_area()
    {
        var view = await CreateAsync("Powerplay");

        var summary = view.Summary;
        Assert.Equal("Powerplay", summary.Title);
        Assert.Equal(("floorball", "full", (Guid?)null, 1), (summary.Sport, summary.FieldType, summary.FolderId, summary.Revision));
        Assert.Equal(new UserReferenceView(Alice, "Alice"), summary.CreatedBy);
        Assert.Equal(new UserReferenceView(Alice, "Alice"), summary.UpdatedBy);
        Assert.Equal(new DateTimeOffset(2026, 10, 4, 8, 0, 1, 234, TimeSpan.Zero), summary.CreatedAt); // cut to milliseconds
        Assert.Equal(summary.CreatedAt, summary.UpdatedAt);
        Assert.Equal(AlicesArea, Assert.Single(_repository.Situations).Area);
        Assert.Equal(summary.Id.ToString(), JsonDocument.Parse(view.Document).RootElement.GetProperty("situation").GetProperty("id").GetString());
    }

    [Fact]
    public async Task A_new_situation_with_a_taken_title_is_rejected_ignoring_case_and_whitespace()
    {
        await CreateAsync("Powerplay");

        var error = await Assert.ThrowsAsync<DuplicateSituationTitleException>(() => CreateAsync("  POWERPLAY "));

        Assert.Equal("POWERPLAY", error.Details["existingTitle"]);
        Assert.Single(_repository.Situations);
    }

    [Fact]
    public async Task Default_titles_are_numbered_within_the_area()
    {
        var first = await CreateAsync("Untitled Situation");
        var second = await CreateAsync("");
        var third = await CreateAsync("untitled situation");

        Assert.Equal(["Untitled Situation", "Untitled Situation (2)", "untitled situation (3)"], new[] { first, second, third }.Select(view => view.Summary.Title));
        Assert.Equal("Untitled Situation (2)", DocumentTitle(second));
    }

    [Fact]
    public async Task Default_titles_are_counted_per_area()
    {
        await CreateAsync("Untitled Situation");
        var bobsArea = AreaReference.Personal(Bob);
        _areas.Writable.Add(bobsArea);

        var view = await Service.CreateAsync(bobsArea, Title(""), SituationDocuments.Valid(), SituationOrigin.New, Cancellation);

        Assert.Equal("Untitled Situation", view.Summary.Title);
    }

    [Theory]
    [InlineData("imported")]
    [InlineData("copy")]
    public async Task Imports_and_copies_with_a_taken_title_get_the_next_free_number(string originName)
    {
        var origin = originName == "copy" ? SituationOrigin.Copy : SituationOrigin.Imported;
        await CreateAsync("Powerplay");
        await CreateAsync("Powerplay (2)");

        var view = await CreateAsync("powerplay", origin);

        Assert.Equal("powerplay (3)", view.Summary.Title);
    }

    [Fact]
    public async Task An_import_with_a_free_title_keeps_it()
    {
        var view = await CreateAsync("Powerplay", SituationOrigin.Imported);

        Assert.Equal("Powerplay", view.Summary.Title);
    }

    [Fact]
    public async Task A_deleted_situations_title_is_free_again()
    {
        var first = await CreateAsync("Powerplay");
        await Service.DeleteAsync(first.Summary.Id, Cancellation);

        var second = await CreateAsync("Powerplay");

        Assert.Equal("Powerplay", second.Summary.Title);
    }

    [Fact]
    public async Task A_numbered_first_save_chooses_again_when_a_parallel_save_took_the_number()
    {
        await CreateAsync("Untitled Situation");
        _repository.TitlesTakenInParallel.Enqueue("Untitled Situation (2)");

        var view = await CreateAsync("");

        Assert.Equal("Untitled Situation (3)", view.Summary.Title);
    }

    [Fact]
    public async Task A_numbered_first_save_gives_up_after_a_few_parallel_losses()
    {
        foreach (var number in Enumerable.Range(1, SituationService.TitleAttempts))
        {
            _repository.TitlesTakenInParallel.Enqueue(number == 1 ? "Untitled Situation" : $"Untitled Situation ({number})");
        }

        await Assert.ThrowsAsync<DuplicateSituationTitleException>(() => CreateAsync(""));
    }

    [Fact]
    public async Task A_new_title_taken_by_a_parallel_save_is_a_duplicate()
    {
        _repository.TitlesTakenInParallel.Enqueue("Powerplay");

        await Assert.ThrowsAsync<DuplicateSituationTitleException>(() => CreateAsync("Powerplay"));
    }

    [Fact]
    public async Task Creating_needs_write_access_to_the_area()
    {
        var bobsArea = AreaReference.Personal(Bob);

        await Assert.ThrowsAsync<SituationAccessDeniedException>(() =>
            Service.CreateAsync(bobsArea, Title("A"), SituationDocuments.Valid(), SituationOrigin.New, Cancellation));
        Assert.Empty(_repository.Situations);
    }

    [Fact]
    public async Task Gets_a_situation_with_its_current_document()
    {
        var created = await CreateAsync("Powerplay");

        var view = await Service.GetAsync(created.Summary.Id, Cancellation);

        Assert.Equal(created, view);
    }

    [Fact]
    public async Task A_situation_in_an_unreadable_area_is_not_found()
    {
        var created = await CreateAsync("Powerplay");
        _areas.Readable.Clear();

        await Assert.ThrowsAsync<SituationNotFoundException>(() => Service.GetAsync(created.Summary.Id, Cancellation));
        await Assert.ThrowsAsync<SituationNotFoundException>(() => Service.DeleteAsync(created.Summary.Id, Cancellation));
        await Assert.ThrowsAsync<SituationNotFoundException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("B"), SituationDocuments.Valid(), Cancellation));
    }

    [Fact]
    public async Task An_unknown_situation_is_not_found() =>
        await Assert.ThrowsAsync<SituationNotFoundException>(() => Service.GetAsync(Guid.NewGuid(), Cancellation));

    [Fact]
    public async Task A_corrupt_situation_without_its_revision_is_an_internal_error()
    {
        var created = await CreateAsync("Powerplay");
        _repository.Revisions.Clear();

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.GetAsync(created.Summary.Id, Cancellation));
    }

    [Fact]
    public async Task Updating_writes_the_next_revision()
    {
        var created = await CreateAsync("Powerplay");
        _clock.UtcNow = _clock.UtcNow.AddMinutes(5);
        _actors.CurrentUserId = Bob;

        var view = await Service.UpdateAsync(created.Summary.Id, 1, Title(" Breakout "), SituationDocuments.Valid(), Cancellation);

        Assert.Equal(2, view.Summary.Revision);
        Assert.Equal("Breakout", view.Summary.Title);
        Assert.Equal("Breakout", DocumentTitle(view));
        Assert.Equal(new UserReferenceView(Alice, "Alice"), view.Summary.CreatedBy);
        Assert.Equal(new UserReferenceView(Bob, "Bob"), view.Summary.UpdatedBy);
        Assert.Equal(created.Summary.CreatedAt.AddMinutes(5), view.Summary.UpdatedAt);
        Assert.Equal([1, 2], _repository.Revisions.Select(revision => revision.Number));
    }

    [Fact]
    public async Task Updating_may_keep_the_own_title()
    {
        var created = await CreateAsync("Powerplay");

        var view = await Service.UpdateAsync(created.Summary.Id, 1, Title("POWERPLAY"), SituationDocuments.Valid(), Cancellation);

        Assert.Equal("POWERPLAY", view.Summary.Title);
    }

    [Fact]
    public async Task Updating_to_another_situations_title_is_rejected_even_the_default_title()
    {
        await CreateAsync("Untitled Situation");
        var other = await CreateAsync("Powerplay");

        await Assert.ThrowsAsync<DuplicateSituationTitleException>(() =>
            Service.UpdateAsync(other.Summary.Id, 1, Title(""), SituationDocuments.Valid(), Cancellation));
        Assert.Equal(1, _repository.Situations[1].CurrentRevision);
    }

    [Fact]
    public async Task Updating_an_old_revision_is_a_save_conflict_with_the_current_revision()
    {
        var created = await CreateAsync("Powerplay");
        await Service.UpdateAsync(created.Summary.Id, 1, Title("Powerplay"), SituationDocuments.Valid(), Cancellation);

        var conflict = await Assert.ThrowsAsync<SituationSaveConflictException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("Mine"), SituationDocuments.Valid(), Cancellation));

        Assert.Equal(2, conflict.CurrentRevision);
    }

    [Fact]
    public async Task Overwriting_saves_on_top_of_the_newest_revision()
    {
        var created = await CreateAsync("Powerplay");
        await Service.UpdateAsync(created.Summary.Id, 1, Title("Theirs"), SituationDocuments.Valid(), Cancellation);
        var conflict = await Assert.ThrowsAsync<SituationSaveConflictException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("Mine"), SituationDocuments.Valid(), Cancellation));

        var view = await Service.UpdateAsync(created.Summary.Id, conflict.CurrentRevision, Title("Mine"), SituationDocuments.Valid(), Cancellation);

        Assert.Equal((3, "Mine"), (view.Summary.Revision, view.Summary.Title));
    }

    [Fact]
    public async Task A_parallel_revision_is_a_save_conflict()
    {
        var created = await CreateAsync("Powerplay");
        _repository.ParallelRevision = 2;

        var conflict = await Assert.ThrowsAsync<SituationSaveConflictException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("Powerplay"), SituationDocuments.Valid(), Cancellation));

        Assert.Equal(2, conflict.CurrentRevision);
    }

    [Fact]
    public async Task A_title_taken_by_a_parallel_save_is_a_duplicate()
    {
        var created = await CreateAsync("Powerplay");
        _repository.TitleTakenOnNextRevision = true;

        await Assert.ThrowsAsync<DuplicateSituationTitleException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("Breakout"), SituationDocuments.Valid(), Cancellation));
    }

    [Fact]
    public async Task The_field_type_cant_change()
    {
        var created = await CreateAsync("Powerplay", fieldType: "full");

        await Assert.ThrowsAsync<SituationPropertyChangedException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("Powerplay"), SituationDocuments.Valid(fieldType: "half"), Cancellation));
    }

    [Fact]
    public async Task Changing_and_deleting_need_write_access()
    {
        var created = await CreateAsync("Powerplay");
        _areas.Writable.Clear();

        await Assert.ThrowsAsync<SituationAccessDeniedException>(() =>
            Service.UpdateAsync(created.Summary.Id, 1, Title("B"), SituationDocuments.Valid(), Cancellation));
        await Assert.ThrowsAsync<SituationAccessDeniedException>(() => Service.DeleteAsync(created.Summary.Id, Cancellation));
        Assert.False(_repository.Situations[0].IsDeleted);
    }

    [Fact]
    public async Task Deleting_is_a_soft_delete()
    {
        var created = await CreateAsync("Powerplay");

        await Service.DeleteAsync(created.Summary.Id, Cancellation);

        Assert.Equal(_clock.UtcNow, _repository.Situations[0].DeletedAt);
        Assert.Empty(await Service.ListAsync(AlicesArea, Cancellation));
        await Assert.ThrowsAsync<SituationNotFoundException>(() => Service.GetAsync(created.Summary.Id, Cancellation));
    }

    [Fact]
    public async Task Deleting_during_a_parallel_save_is_a_save_conflict()
    {
        var created = await CreateAsync("Powerplay");
        _repository.ParallelRevision = 2;

        await Assert.ThrowsAsync<SituationSaveConflictException>(() => Service.DeleteAsync(created.Summary.Id, Cancellation));
    }

    [Fact]
    public async Task Lists_the_areas_situations_most_recently_changed_first_then_by_title()
    {
        var older = await CreateAsync("Zebra");
        _clock.UtcNow = _clock.UtcNow.AddMinutes(1);
        await CreateAsync("beta");
        await CreateAsync("Alpha");
        _clock.UtcNow = _clock.UtcNow.AddMinutes(1);
        await Service.UpdateAsync(older.Summary.Id, 1, Title("Zebra"), SituationDocuments.Valid(), Cancellation);

        var list = await Service.ListAsync(AlicesArea, Cancellation);

        Assert.Equal(["Zebra", "Alpha", "beta"], list.Select(situation => situation.Title));
    }

    [Fact]
    public async Task Lists_deleted_users_without_a_name()
    {
        await CreateAsync("Powerplay");
        _actors.Names.Remove(Alice);

        var summary = Assert.Single(await Service.ListAsync(AlicesArea, Cancellation));

        Assert.Equal(new UserReferenceView(Alice, null), summary.CreatedBy);
    }

    [Fact]
    public async Task Listing_needs_read_access()
    {
        _areas.Readable.Clear();

        await Assert.ThrowsAsync<SituationAccessDeniedException>(() => Service.ListAsync(AlicesArea, Cancellation));
    }

    [Fact]
    public async Task Rejects_missing_arguments()
    {
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.ListAsync(null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.CreateAsync(null!, Title("A"), SituationDocuments.Valid(), SituationOrigin.New, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.CreateAsync(AlicesArea, null!, SituationDocuments.Valid(), SituationOrigin.New, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.CreateAsync(AlicesArea, Title("A"), null!, SituationOrigin.New, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.UpdateAsync(Guid.NewGuid(), 1, null!, SituationDocuments.Valid(), Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.UpdateAsync(Guid.NewGuid(), 1, Title("A"), null!, Cancellation));
    }
}
