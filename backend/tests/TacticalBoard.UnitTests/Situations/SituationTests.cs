using System.Text.Json;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.SharedKernel.Errors;
using TacticalBoard.Situations.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Situations;

public class SituationTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly Guid Id = Guid.Parse("0199a6d0-0000-7000-8000-000000000001");
    private static readonly DateTimeOffset Created = new(2026, 10, 4, 8, 0, 0, TimeSpan.Zero);

    private static (Situation Situation, SituationRevision Revision) Create(string title = "Powerplay", string fieldType = "full") =>
        Situation.Create(Id, AreaReference.Personal(Alice), null, SituationTitle.FromTrusted(title), SituationDocuments.Valid(fieldType: fieldType), Created, Alice);

    private static JsonElement Content(SituationRevision revision) => JsonDocument.Parse(revision.Document).RootElement.GetProperty("situation");

    [Fact]
    public void Creating_writes_revision_1_with_the_metadata()
    {
        var (situation, revision) = Create(fieldType: "half");

        Assert.Equal(Id, situation.Id);
        Assert.Equal(AreaReference.Personal(Alice), situation.Area);
        Assert.Null(situation.FolderId);
        Assert.Equal("Powerplay", situation.Title);
        Assert.Equal("POWERPLAY", situation.NormalizedTitle);
        Assert.Equal("floorball", situation.Sport);
        Assert.Equal("half", situation.FieldType);
        Assert.Equal(3, situation.FormatVersion);
        Assert.Equal((Created, Alice, Created, Alice), (situation.CreatedAt, situation.CreatedBy, situation.UpdatedAt, situation.UpdatedBy));
        Assert.Equal(1, situation.CurrentRevision);
        Assert.False(situation.IsDeleted);

        Assert.Equal((Id, 1, Created, Alice), (revision.SituationId, revision.Number, revision.CreatedAt, revision.CreatedBy));
        Assert.Equal(Id.ToString(), Content(revision).GetProperty("id").GetString());
        Assert.Equal("Powerplay", Content(revision).GetProperty("title").GetString());
        Assert.Equal("2026-10-04T08:00:00.000Z", Content(revision).GetProperty("createdAt").GetString());
    }

    [Fact]
    public void Revising_writes_the_next_revision_and_keeps_the_creation()
    {
        var (situation, _) = Create();
        var later = Created.AddHours(1);

        var revision = situation.Revise(SituationTitle.FromTrusted("Breakout"), SituationDocuments.Valid(), later, Bob);

        Assert.Equal(2, revision.Number);
        Assert.Equal(2, situation.CurrentRevision);
        Assert.Equal(("Breakout", "BREAKOUT"), (situation.Title, situation.NormalizedTitle));
        Assert.Equal((Created, Alice, later, Bob), (situation.CreatedAt, situation.CreatedBy, situation.UpdatedAt, situation.UpdatedBy));
        Assert.Equal("2026-10-04T08:00:00.000Z", Content(revision).GetProperty("createdAt").GetString());
        Assert.Equal("2026-10-04T09:00:00.000Z", Content(revision).GetProperty("updatedAt").GetString());
        Assert.Equal((later, Bob), (revision.CreatedAt, revision.CreatedBy));
    }

    [Fact]
    public void The_field_type_is_fixed()
    {
        var (situation, _) = Create(fieldType: "full");

        var error = Assert.Throws<SituationPropertyChangedException>(() =>
            situation.Revise(SituationTitle.FromTrusted("Powerplay"), SituationDocuments.Valid(fieldType: "half"), Created, Alice));

        Assert.Equal(("field-type-changed", DomainErrorKind.Validation), (error.Code, error.Kind));
        Assert.Equal(1, situation.CurrentRevision);
    }

    [Fact]
    public void The_sport_is_fixed()
    {
        var (situation, _) = Create();
        typeof(Situation).GetProperty(nameof(Situation.Sport))!.SetValue(situation, "hockey");

        var error = Assert.Throws<SituationPropertyChangedException>(() =>
            situation.Revise(SituationTitle.FromTrusted("Powerplay"), SituationDocuments.Valid(), Created, Alice));

        Assert.Equal("sport-changed", error.Code);
    }

    [Fact]
    public void Rejects_missing_or_empty_parts()
    {
        var area = AreaReference.Personal(Alice);
        var title = SituationTitle.FromTrusted("A");
        var document = SituationDocuments.Valid();

        Assert.Throws<ArgumentException>(() => Situation.Create(Guid.Empty, area, null, title, document, Created, Alice));
        Assert.Throws<ArgumentException>(() => Situation.Create(Id, area, Guid.Empty, title, document, Created, Alice));
        Assert.Throws<ArgumentNullException>(() => Situation.Create(Id, null!, null, title, document, Created, Alice));
        Assert.Throws<ArgumentNullException>(() => Situation.Create(Id, area, null, null!, document, Created, Alice));
        Assert.Throws<ArgumentNullException>(() => Situation.Create(Id, area, null, title, null!, Created, Alice));
        var (situation, _) = Create();
        Assert.Throws<ArgumentNullException>(() => situation.Revise(null!, document, Created, Alice));
        Assert.Throws<ArgumentNullException>(() => situation.Revise(title, null!, Created, Alice));
        Assert.Throws<ArgumentOutOfRangeException>(() => new SituationRevision(Id, 0, "{}", Created, Alice));
        Assert.Throws<ArgumentException>(() => new SituationRevision(Id, 1, " ", Created, Alice));
    }

    [Fact]
    public void Deleting_is_a_soft_delete()
    {
        var (situation, _) = Create();

        situation.MarkDeleted(Created);

        Assert.True(situation.IsDeleted);
        Assert.Equal(Created, situation.DeletedAt);
    }

    [Fact]
    public void Can_be_created_in_a_folder()
    {
        var folder = Guid.Parse("0199a6d0-0000-7000-8000-0000000000f1");

        var (situation, _) = Situation.Create(Id, AreaReference.Personal(Alice), folder, SituationTitle.FromTrusted("A"), SituationDocuments.Valid(), Created, Alice);

        Assert.Equal(folder, situation.FolderId);
    }

    [Fact]
    public void Moving_changes_only_the_folder()
    {
        var (situation, _) = Create();
        var folder = Guid.Parse("0199a6d0-0000-7000-8000-0000000000f1");

        situation.MoveTo(folder);

        Assert.Equal(folder, situation.FolderId);
        Assert.Equal((1, Created, Alice), (situation.CurrentRevision, situation.UpdatedAt, situation.UpdatedBy));

        situation.MoveTo(null);

        Assert.Null(situation.FolderId);
        Assert.Throws<ArgumentException>(() => situation.MoveTo(Guid.Empty));
    }
}
