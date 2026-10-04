using System.Text.Json;
using TacticalBoard.Situations.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Situations;

public class SituationDocumentTests
{
    [Fact]
    public void Parses_a_valid_document()
    {
        Assert.True(SituationDocument.TryParse(SituationDocuments.Element(SituationDocuments.Minimal(" Powerplay ", "half")), out var document, out var issues));

        Assert.Empty(issues);
        Assert.Equal(" Powerplay ", document.Title);
        Assert.Equal("floorball", document.Sport);
        Assert.Equal("half", document.FieldType);
        Assert.Equal(3, SituationDocument.FormatVersion);
    }

    [Fact]
    public void Reports_the_issues_of_an_invalid_document()
    {
        var file = SituationDocuments.Minimal();
        file["situation"]!["frames"] = new System.Text.Json.Nodes.JsonArray();

        Assert.False(SituationDocument.TryParse(SituationDocuments.Element(file), out var document, out var issues));

        Assert.Null(document);
        Assert.Equal([new DocumentIssue("situation.frames", "expected at least one frame")], issues);
    }

    [Fact]
    public void Stamps_the_server_owned_values_and_keeps_the_rest()
    {
        var file = SituationDocuments.Minimal("ignored");
        file["situation"]!["extra"] = "kept";
        Assert.True(SituationDocument.TryParse(SituationDocuments.Element(file), out var document, out _));
        var id = Guid.Parse("0199a6d0-0000-7000-8000-000000000042");

        var json = document.Stamp(
            id,
            SituationTitle.FromTrusted("Powerplay (2)"),
            new DateTimeOffset(2026, 10, 4, 8, 30, 0, 123, TimeSpan.Zero),
            new DateTimeOffset(2026, 10, 4, 10, 0, 0, 5, TimeSpan.FromHours(2)));

        var situation = JsonDocument.Parse(json).RootElement.GetProperty("situation");
        Assert.Equal(id.ToString(), situation.GetProperty("id").GetString());
        Assert.Equal("Powerplay (2)", situation.GetProperty("title").GetString());
        Assert.Equal("2026-10-04T08:30:00.123Z", situation.GetProperty("createdAt").GetString());
        Assert.Equal("2026-10-04T08:00:00.005Z", situation.GetProperty("updatedAt").GetString());
        Assert.Equal("kept", situation.GetProperty("extra").GetString());
        Assert.Equal("f1", situation.GetProperty("frames")[0].GetProperty("id").GetString());
        Assert.Equal("ignored", document.Title);
    }

    [Fact]
    public void A_stamped_document_is_valid_again()
    {
        var document = SituationDocuments.Valid();

        var json = document.Stamp(Guid.NewGuid(), SituationTitle.FromTrusted("A"), DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch);

        Assert.Empty(new SituationDocumentValidator().Validate(SituationDocuments.Parse(json)));
    }

    [Fact]
    public void Stamping_needs_a_title() =>
        Assert.Throws<ArgumentNullException>(() => SituationDocuments.Valid().Stamp(Guid.NewGuid(), null!, DateTimeOffset.UnixEpoch, DateTimeOffset.UnixEpoch));
}
