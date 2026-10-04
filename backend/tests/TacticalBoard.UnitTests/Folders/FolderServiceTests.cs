using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Folders;

public class FolderServiceTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly AreaReference AlicesArea = AreaReference.Personal(Alice);

    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryFolderRepository _repository;
    private readonly FakeFolderContents _contents = new();
    private readonly FakeAreaAccess _areas = new(Alice);
    private readonly FakeActorDirectory _actors = new(Alice);
    private readonly FixedClock _clock = new(new DateTimeOffset(2026, 10, 4, 8, 0, 0, TimeSpan.Zero));

    public FolderServiceTests()
    {
        _repository = new InMemoryFolderRepository(_transactions);
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private readonly SequenceIdGenerator _ids = new();

    private FolderService Service => new(_repository, _contents, _areas, _actors, _transactions, _ids, _clock);

    private static FolderName Name(string text) => FolderTests.Name(text);

    private Task<FolderView> CreateAsync(string name, AreaReference? area = null) => Service.CreateAsync(area ?? AlicesArea, Name(name), Cancellation);

    [Fact]
    public async Task Creates_a_folder_in_the_area()
    {
        var view = await CreateAsync(" Set pieces ");

        Assert.Equal(("Set pieces", _clock.UtcNow, _clock.UtcNow), (view.Name, view.CreatedAt, view.UpdatedAt));
        var stored = Assert.Single(_repository.Folders);
        Assert.Equal((view.Id, AlicesArea, Alice), (stored.Id, stored.Area, stored.CreatedBy));
    }

    [Fact]
    public async Task A_taken_name_is_rejected_ignoring_case_and_whitespace()
    {
        await CreateAsync("Set pieces");

        var error = await Assert.ThrowsAsync<DuplicateFolderNameException>(() => CreateAsync("  SET PIECES"));

        Assert.Equal("SET PIECES", error.Details["existingName"]);
        Assert.Single(_repository.Folders);
    }

    [Fact]
    public async Task Names_are_unique_per_area()
    {
        var bobsArea = AreaReference.Personal(Bob);
        _areas.Writable.Add(bobsArea);
        await CreateAsync("Set pieces");

        var view = await CreateAsync("Set pieces", bobsArea);

        Assert.Equal("Set pieces", view.Name);
    }

    [Fact]
    public async Task A_name_taken_by_a_parallel_save_is_a_duplicate()
    {
        _repository.NameTakenInParallel = true;

        await Assert.ThrowsAsync<DuplicateFolderNameException>(() => CreateAsync("Set pieces"));
    }

    [Fact]
    public async Task Creating_needs_write_access()
    {
        _areas.Writable.Clear();

        await Assert.ThrowsAsync<FolderAccessDeniedException>(() => CreateAsync("Set pieces"));
        Assert.Empty(_repository.Folders);
    }

    [Fact]
    public async Task Lists_the_areas_folders_by_name_ignoring_case()
    {
        await CreateAsync("beta");
        await CreateAsync("Alpha");
        await CreateAsync("Übergang");
        await CreateAsync("Zebra");
        var deleted = await CreateAsync("Deleted");
        await Service.DeleteAsync(deleted.Id, Cancellation);
        var bobsArea = AreaReference.Personal(Bob);
        _areas.Writable.Add(bobsArea);
        await CreateAsync("Bob's", bobsArea);

        var list = await Service.ListAsync(AlicesArea, Cancellation);

        Assert.Equal(["Alpha", "beta", "Übergang", "Zebra"], list.Select(folder => folder.Name));
    }

    [Fact]
    public async Task Listing_needs_read_access()
    {
        _areas.Readable.Clear();

        await Assert.ThrowsAsync<FolderAccessDeniedException>(() => Service.ListAsync(AlicesArea, Cancellation));
    }

    [Fact]
    public async Task Gets_a_folder()
    {
        var created = await CreateAsync("Set pieces");

        Assert.Equal(created, await Service.GetAsync(created.Id, Cancellation));
    }

    [Fact]
    public async Task An_unknown_deleted_or_unreadable_folder_is_not_found()
    {
        var created = await CreateAsync("Set pieces");
        await Assert.ThrowsAsync<FolderNotFoundException>(() => Service.GetAsync(Guid.NewGuid(), Cancellation));

        _areas.Readable.Clear();
        await Assert.ThrowsAsync<FolderNotFoundException>(() => Service.GetAsync(created.Id, Cancellation));
        await Assert.ThrowsAsync<FolderNotFoundException>(() => Service.RenameAsync(created.Id, Name("B"), Cancellation));
        await Assert.ThrowsAsync<FolderNotFoundException>(() => Service.DeleteAsync(created.Id, Cancellation));

        _areas.Readable.Add(AlicesArea);
        await Service.DeleteAsync(created.Id, Cancellation);
        await Assert.ThrowsAsync<FolderNotFoundException>(() => Service.GetAsync(created.Id, Cancellation));
    }

    [Fact]
    public async Task Renames_a_folder()
    {
        var created = await CreateAsync("Set pieces");
        _clock.UtcNow = _clock.UtcNow.AddMinutes(3);
        _actors.CurrentUserId = Bob;

        var renamed = await Service.RenameAsync(created.Id, Name(" Breakouts "), Cancellation);

        Assert.Equal(("Breakouts", created.CreatedAt, _clock.UtcNow), (renamed.Name, renamed.CreatedAt, renamed.UpdatedAt));
        Assert.Equal(Bob, _repository.Folders[0].UpdatedBy);
    }

    [Fact]
    public async Task Renaming_may_change_the_case_of_the_own_name()
    {
        var created = await CreateAsync("Set pieces");

        var renamed = await Service.RenameAsync(created.Id, Name("SET PIECES"), Cancellation);

        Assert.Equal("SET PIECES", renamed.Name);
    }

    [Fact]
    public async Task Renaming_to_another_folders_name_is_rejected()
    {
        await CreateAsync("Set pieces");
        var other = await CreateAsync("Breakouts");

        await Assert.ThrowsAsync<DuplicateFolderNameException>(() => Service.RenameAsync(other.Id, Name("set pieces"), Cancellation));
        Assert.Equal("Breakouts", _repository.Folders[1].Name);
    }

    [Fact]
    public async Task Renaming_to_a_name_taken_by_a_parallel_save_is_a_duplicate()
    {
        var created = await CreateAsync("Set pieces");
        _repository.NameTakenInParallel = true;

        await Assert.ThrowsAsync<DuplicateFolderNameException>(() => Service.RenameAsync(created.Id, Name("Breakouts"), Cancellation));
    }

    [Fact]
    public async Task Deletes_an_empty_folder_softly_in_a_transaction_with_the_folder_locked()
    {
        var created = await CreateAsync("Set pieces");
        _clock.UtcNow = _clock.UtcNow.AddMinutes(1);

        await Service.DeleteAsync(created.Id, Cancellation);

        Assert.Equal(_clock.UtcNow, _repository.Folders[0].DeletedAt);
        Assert.Equal([(created.Id, "deletion", true)], _repository.Locks);
        Assert.Equal((1, 0), (_transactions.Transactions, _transactions.RolledBack));
        Assert.Empty(await Service.ListAsync(AlicesArea, Cancellation));
    }

    [Fact]
    public async Task A_deleted_folders_name_is_free_again()
    {
        var created = await CreateAsync("Set pieces");
        await Service.DeleteAsync(created.Id, Cancellation);

        var again = await CreateAsync("Set pieces");

        Assert.NotEqual(created.Id, again.Id);
    }

    [Fact]
    public async Task A_folder_with_situations_is_not_deleted()
    {
        var created = await CreateAsync("Set pieces");
        _contents.NonEmpty.Add(created.Id);

        var error = await Assert.ThrowsAsync<FolderNotEmptyException>(() => Service.DeleteAsync(created.Id, Cancellation));

        Assert.Contains("Set pieces", error.Message, StringComparison.Ordinal);
        Assert.False(_repository.Folders[0].IsDeleted);
        Assert.Equal(1, _transactions.RolledBack);
    }

    [Fact]
    public async Task A_folder_deleted_in_parallel_is_not_found()
    {
        var created = await CreateAsync("Set pieces");
        _repository.DeletedInParallel = true;

        await Assert.ThrowsAsync<FolderNotFoundException>(() => Service.DeleteAsync(created.Id, Cancellation));
    }

    [Fact]
    public async Task Renaming_and_deleting_need_write_access()
    {
        var created = await CreateAsync("Set pieces");
        _areas.Writable.Clear();

        await Assert.ThrowsAsync<FolderAccessDeniedException>(() => Service.RenameAsync(created.Id, Name("B"), Cancellation));
        await Assert.ThrowsAsync<FolderAccessDeniedException>(() => Service.DeleteAsync(created.Id, Cancellation));
        Assert.Equal(("Set pieces", false), (_repository.Folders[0].Name, _repository.Folders[0].IsDeleted));
    }

    [Fact]
    public async Task Rejects_missing_arguments()
    {
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.ListAsync(null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.CreateAsync(null!, Name("A"), Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.CreateAsync(AlicesArea, null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service.RenameAsync(Guid.NewGuid(), null!, Cancellation));
    }

    [Fact]
    public async Task The_directory_tells_other_modules_a_folders_area_and_locks_it_for_placing()
    {
        var created = await CreateAsync("Set pieces");
        var directory = new FolderDirectory(_repository);

        Assert.Equal(new FolderReference(created.Id, AlicesArea), await directory.FindAsync(created.Id, Cancellation));
        Assert.Equal(new FolderReference(created.Id, AlicesArea), await directory.FindForPlacingAsync(created.Id, Cancellation));
        Assert.Equal([(created.Id, "placing", false)], _repository.Locks);
        Assert.Null(await directory.FindAsync(Guid.NewGuid(), Cancellation));

        await Service.DeleteAsync(created.Id, Cancellation);
        Assert.Null(await directory.FindAsync(created.Id, Cancellation));
        Assert.Null(await directory.FindForPlacingAsync(created.Id, Cancellation));
    }
}
