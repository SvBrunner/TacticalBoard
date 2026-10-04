using System.Text.Json.Nodes;
using TacticalBoard.Situations.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Situations;

/// <summary>
/// Port of the frontend's <c>SituationFileValidator.test.ts</c> (same cases, paths and messages),
/// plus the backend's current-version rule. Keep both in sync (arc42 ch. 8.3).
/// </summary>
public class SituationDocumentValidatorTests
{
    private static readonly SituationDocumentValidator Validator = new();

    private static List<string> IssuesFor(Action<JsonObject> mutate)
    {
        var file = SituationDocuments.Minimal();
        mutate(file);
        return Issues(file);
    }

    private static List<string> Issues(JsonNode? file) =>
        Validator.Validate(SituationDocuments.Parse(file?.ToJsonString() ?? "null")).Select(issue => issue.ToString()).ToList();

    private static JsonObject Situation(JsonObject file) => file["situation"]!.AsObject();

    private static JsonObject Frame(JsonObject file, int index = 0) => Situation(file)["frames"]![index]!.AsObject();

    private static JsonObject Element(JsonObject file, int index = 0) => Frame(file)["elements"]![index]!.AsObject();

    [Fact]
    public void Accepts_a_minimal_document() => Assert.Empty(Issues(SituationDocuments.Minimal()));

    [Fact]
    public void Accepts_the_frontends_current_version_fixture_with_arrows() =>
        Assert.Empty(Validator.Validate(SituationDocuments.Parse(SituationDocuments.FrontendFixture(3))));

    [Fact]
    public void Accepts_the_content_of_the_v2_fixture_as_version_3()
    {
        var file = JsonNode.Parse(SituationDocuments.FrontendFixture(2))!.AsObject();
        file["formatVersion"] = 3;

        Assert.Empty(Issues(file));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(4)]
    public void Rejects_other_format_versions_than_the_current_one(int version) =>
        Assert.Equal(["formatVersion: expected 3 (the current format version)"], IssuesFor(file => file["formatVersion"] = version));

    [Fact]
    public void Rejects_an_older_fixture_unmigrated() =>
        Assert.Contains("formatVersion: expected 3 (the current format version)", Issues(JsonNode.Parse(SituationDocuments.FrontendFixture(1))));

    [Fact]
    public void Accepts_a_frame_without_elements() =>
        Assert.Empty(IssuesFor(file => Frame(file)["elements"] = new JsonArray()));

    [Fact]
    public void Accepts_timestamps_with_an_offset_and_without_milliseconds() =>
        Assert.Empty(IssuesFor(file =>
        {
            Situation(file)["createdAt"] = "2026-01-01T10:00:00+02:00";
            Situation(file)["updatedAt"] = "2026-01-01T10:00Z";
        }));

    [Fact]
    public void Ignores_unknown_extra_properties() =>
        Assert.Empty(IssuesFor(file =>
        {
            file["extra"] = true;
            Situation(file)["extra"] = new JsonObject { ["nested"] = 1 };
            Frame(file)["extra"] = "x";
            Element(file)["tag"] = "C";
        }));

    [Fact]
    public void Allows_the_same_element_id_in_different_frames() =>
        Assert.Empty(IssuesFor(file => Situation(file)["frames"]!.AsArray().Add(new JsonObject
        {
            ["id"] = "f2",
            ["description"] = "",
            ["elements"] = new JsonArray { new JsonObject { ["id"] = "e1", ["type"] = "Player", ["color"] = "red", ["x"] = 5, ["y"] = 5, ["label"] = "" } },
        })));

    [Fact]
    public void Allows_any_number_of_balls_and_players() =>
        Assert.Empty(IssuesFor(file => Frame(file)["elements"] = new JsonArray(Enumerable.Range(0, 30).Select(i => (JsonNode)new JsonObject
        {
            ["id"] = $"e{i}",
            ["type"] = i % 2 == 0 ? "Ball" : "Player",
            ["color"] = "red",
            ["x"] = i,
            ["y"] = i,
            ["label"] = "",
        }).ToArray())));

    [Theory]
    [InlineData("")]
    [InlineData("C")]
    [InlineData("LV")]
    [InlineData("10")]
    [InlineData("c")]
    [InlineData("Ü")]
    [InlineData("\U0001D400")] // a letter outside the BMP counts as one character
    public void Accepts_the_label(string label) => Assert.Empty(IssuesFor(file => Element(file)["label"] = label));

    [Fact]
    public void Accepts_a_label_on_a_non_player_element() =>
        Assert.Empty(IssuesFor(file =>
        {
            Element(file)["type"] = "Circle";
            Element(file)["label"] = "C";
        }));

    [Theory]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("\"text\"")]
    [InlineData("42")]
    public void Rejects_a_non_object_root(string json) =>
        Assert.Equal(["(root): expected object"], Validator.Validate(SituationDocuments.Parse(json)).Select(issue => issue.ToString()));

    public static TheoryData<string, Action<JsonObject>, string> Rejected => new()
    {
        { "wrong format", f => f["format"] = "other", "format: expected \"tacticalboard.situation\"" },
        { "missing format", f => f.Remove("format"), "format: expected \"tacticalboard.situation\"" },
        { "zero formatVersion", f => f["formatVersion"] = 0, "formatVersion: expected positive integer" },
        { "fractional formatVersion", f => f["formatVersion"] = 1.5, "formatVersion: expected positive integer" },
        { "string formatVersion", f => f["formatVersion"] = "1", "formatVersion: expected positive integer" },
        { "missing situation", f => f.Remove("situation"), "situation: expected object" },
        { "empty situation id", f => Situation(f)["id"] = "", "situation.id: expected non-empty string" },
        { "missing situation id", f => Situation(f).Remove("id"), "situation.id: expected non-empty string" },
        { "non-string title", f => Situation(f)["title"] = 5, "situation.title: expected string" },
        { "non-string description", f => Situation(f)["description"] = null, "situation.description: expected string" },
        { "unsupported sport", f => Situation(f)["sport"] = "hockey", "situation.sport: expected supported sport" },
        { "invalid fieldType", f => Situation(f)["fieldType"] = "quarter", "situation.fieldType: expected \"full\" or \"half\"" },
        { "invalid createdAt", f => Situation(f)["createdAt"] = "yesterday", "situation.createdAt: expected ISO 8601 timestamp" },
        { "impossible updatedAt", f => Situation(f)["updatedAt"] = "2026-13-45T99:00:00Z", "situation.updatedAt: expected ISO 8601 timestamp" },
        { "date-only updatedAt", f => Situation(f)["updatedAt"] = "2026-01-01", "situation.updatedAt: expected ISO 8601 timestamp" },
        { "frames not an array", f => Situation(f)["frames"] = new JsonObject(), "situation.frames: expected array" },
        { "empty frames", f => Situation(f)["frames"] = new JsonArray(), "situation.frames: expected at least one frame" },
        { "frame not an object", f => Situation(f)["frames"]![0] = "frame", "situation.frames[0]: expected object" },
        { "empty frame id", f => Frame(f)["id"] = "", "situation.frames[0].id: expected non-empty string" },
        { "non-string frame description", f => Frame(f)["description"] = 1, "situation.frames[0].description: expected string" },
        { "elements not an array", f => Frame(f)["elements"] = null, "situation.frames[0].elements: expected array" },
        { "element not an object", f => Frame(f)["elements"]![0] = 7, "situation.frames[0].elements[0]: expected object" },
        { "empty element id", f => Element(f)["id"] = "", "situation.frames[0].elements[0].id: expected non-empty string" },
        { "unknown element type", f => Element(f)["type"] = "Arrow", "situation.frames[0].elements[0].type: expected known element type" },
        { "empty color", f => Element(f)["color"] = "", "situation.frames[0].elements[0].color: expected non-empty string" },
        { "string x", f => Element(f)["x"] = "1", "situation.frames[0].elements[0].x: expected finite number" },
        { "out-of-range y", f => Element(f)["y"] = JsonNode.Parse("1e400"), "situation.frames[0].elements[0].y: expected finite number" },
        { "missing label", f => Element(f).Remove("label"), "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits" },
        { "non-string label", f => Element(f)["label"] = 7, "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits" },
        { "null label", f => Element(f)["label"] = null, "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits" },
        { "too long label", f => Element(f)["label"] = "ABC", "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits" },
        { "label with a space", f => Element(f)["label"] = "L V", "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits" },
        { "label with punctuation", f => Element(f)["label"] = "#9", "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits" },
    };

    [Theory]
    [MemberData(nameof(Rejected))]
#pragma warning disable xUnit1026 // The name makes the test cases readable.
    public void Rejects(string name, Action<JsonObject> mutate, string expected) => Assert.Equal([expected], IssuesFor(mutate));
#pragma warning restore xUnit1026

    [Fact]
    public void Rejects_duplicate_frame_ids() =>
        Assert.Equal(
            ["situation.frames[1].id: duplicate frame id \"f1\""],
            IssuesFor(file => Situation(file)["frames"]!.AsArray().Add(new JsonObject { ["id"] = "f1", ["description"] = "", ["elements"] = new JsonArray() })));

    [Fact]
    public void Rejects_duplicate_element_ids_within_a_frame() =>
        Assert.Equal(
            ["situation.frames[0].elements[1].id: duplicate element id \"e1\" in frame"],
            IssuesFor(file => Frame(file)["elements"]!.AsArray().Add(new JsonObject { ["id"] = "e1", ["type"] = "Ball", ["color"] = "black", ["x"] = 1, ["y"] = 1, ["label"] = "" })));

    [Fact]
    public void Reports_multiple_issues_at_once() =>
        Assert.Equal(
            [
                "situation.title: expected string",
                "situation.fieldType: expected \"full\" or \"half\"",
                "situation.frames[0].elements[0].x: expected finite number",
                "situation.frames[0].elements[1].type: expected known element type",
                "situation.frames[0].elements[1].color: expected non-empty string",
            ],
            IssuesFor(file =>
            {
                Situation(file)["title"] = 1;
                Situation(file)["fieldType"] = "quarter";
                Element(file)["x"] = null;
                Frame(file)["elements"]!.AsArray().Add(new JsonObject { ["id"] = "e2", ["type"] = "Unknown", ["color"] = "", ["x"] = 0, ["y"] = 0, ["label"] = "" });
            }));

    private static JsonObject ArrowFile()
    {
        var file = SituationDocuments.Minimal();
        Frame(file)["elements"] = new JsonArray
        {
            new JsonObject
            {
                ["id"] = "a1",
                ["type"] = "Pass",
                ["color"] = "black",
                ["start"] = new JsonObject { ["x"] = 0, ["y"] = 0 },
                ["end"] = new JsonObject { ["x"] = 10, ["y"] = 20 },
                ["bends"] = new JsonArray(),
            },
        };
        return file;
    }

    private static List<string> ArrowIssues(Action<JsonObject> mutate)
    {
        var file = ArrowFile();
        mutate(Element(file));
        return Issues(file);
    }

    [Theory]
    [InlineData("Pass")]
    [InlineData("Run")]
    [InlineData("Shot")]
    public void Accepts_a_straight_arrow(string type) => Assert.Empty(ArrowIssues(arrow => arrow["type"] = type));

    [Fact]
    public void Accepts_several_bends() =>
        Assert.Empty(ArrowIssues(arrow => arrow["bends"] = new JsonArray(
            new JsonObject { ["x"] = 1, ["y"] = 1 },
            new JsonObject { ["x"] = 2.5, ["y"] = -3 },
            new JsonObject { ["x"] = 4, ["y"] = 4 })));

    [Fact]
    public void An_arrow_needs_no_x_y_or_label_and_ignores_extra_properties()
    {
        Assert.Empty(ArrowIssues(arrow =>
        {
            arrow["x"] = "nonsense";
            arrow["label"] = "TOO LONG";
            arrow["note"] = 1;
        }));
        Assert.Empty(ArrowIssues(arrow => arrow["start"]!["z"] = 3));
    }

    public static TheoryData<string, Action<JsonObject>, string[]> RejectedArrows => new()
    {
        { "missing start", a => a.Remove("start"), ["start: expected object with x and y"] },
        { "start not an object", a => a["start"] = new JsonArray(1, 2), ["start: expected object with x and y"] },
        { "non-numeric start.x", a => a["start"]!["x"] = "1", ["start.x: expected finite number"] },
        { "missing end", a => a.Remove("end"), ["end: expected object with x and y"] },
        { "out-of-range end.y", a => a["end"]!["y"] = JsonNode.Parse("-1e999"), ["end.y: expected finite number"] },
        { "missing bends", a => a.Remove("bends"), ["bends: expected array"] },
        { "bends not an array", a => a["bends"] = new JsonObject { ["x"] = 1, ["y"] = 1 }, ["bends: expected array"] },
        { "a bend that is not an object", a => a["bends"] = new JsonArray(new JsonObject { ["x"] = 1, ["y"] = 1 }, 7), ["bends[1]: expected object with x and y"] },
        { "a bend without y", a => a["bends"] = new JsonArray(new JsonObject { ["x"] = 1 }), ["bends[0].y: expected finite number"] },
        { "an empty color", a => a["color"] = "", ["color: expected non-empty string"] },
    };

    [Theory]
    [MemberData(nameof(RejectedArrows))]
#pragma warning disable xUnit1026 // The name makes the test cases readable.
    public void Rejects_an_arrow_with(string name, Action<JsonObject> mutate, string[] expected) =>
        Assert.Equal(expected.Select(issue => "situation.frames[0].elements[0]." + issue), ArrowIssues(mutate));
#pragma warning restore xUnit1026

    [Fact]
    public void Reports_all_arrow_issues_at_once() =>
        Assert.Equal(
            [
                "situation.frames[0].elements[0].start: expected object with x and y",
                "situation.frames[0].elements[0].end.x: expected finite number",
                "situation.frames[0].elements[0].bends[0]: expected object with x and y",
            ],
            ArrowIssues(arrow =>
            {
                arrow["start"] = null;
                arrow["end"]!["x"] = "NaN";
                arrow["bends"] = new JsonArray((JsonNode?)null);
            }));

    [Fact]
    public void Checks_a_point_elements_x_y_and_label_not_an_arrows_start_and_end() =>
        Assert.Equal(
            [
                "situation.frames[0].elements[0].x: expected finite number",
                "situation.frames[0].elements[0].y: expected finite number",
                "situation.frames[0].elements[0].label: expected string of at most 2 letters or digits",
            ],
            ArrowIssues(arrow => arrow["type"] = "Player"));

    [Theory]
    [InlineData("", true)]
    [InlineData("A1", true)]
    [InlineData("ÄÖ", true)]
    [InlineData("A1B", false)]
    [InlineData("-", false)]
    [InlineData("²", false)] // superscript two is a digit, but not a decimal digit
    public void Position_labels(string label, bool valid) => Assert.Equal(valid, SituationDocumentValidator.IsValidLabel(label));

    [Fact]
    public void Gives_every_issue_a_stable_code_with_its_values()
    {
        var file = SituationDocuments.Minimal();
        file["format"] = "other";
        file["situation"]!["fieldType"] = "quarter";
        Element(file)["x"] = "1";
        Element(file)["label"] = "ABC";

        var issues = Validator.Validate(SituationDocuments.Parse(file.ToJsonString()));

        Assert.Equal(
            [("format", "expected-value"), ("situation.fieldType", "expected-field-type"), ("situation.frames[0].elements[0].x", "expected-finite-number"), ("situation.frames[0].elements[0].label", "expected-label")],
            issues.Select(issue => (issue.Path, issue.Error.Code)));
        Assert.Equal("tacticalboard.situation", issues[0].Error.Values["expected"]);
    }

    [Fact]
    public void Codes_a_wrong_version_with_the_current_one_and_duplicates_with_the_id()
    {
        var file = SituationDocuments.Minimal();
        file["formatVersion"] = 2;
        var frames = Situation(file)["frames"]!.AsArray();
        frames.Add(frames[0]!.DeepClone());

        var issues = Validator.Validate(SituationDocuments.Parse(file.ToJsonString()));

        var version = Assert.Single(issues, issue => issue.Path == "formatVersion").Error;
        Assert.Equal(("expected-current-version", 3), (version.Code, version.Values["version"]));
        var duplicate = Assert.Single(issues, issue => issue.Path == "situation.frames[1].id").Error;
        Assert.Equal("duplicate-id", duplicate.Code);
        Assert.Equal(Frame(file)["id"]!.GetValue<string>(), duplicate.Values["id"]);
    }
}

