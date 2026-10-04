using System.Text.Json;
using System.Text.Json.Nodes;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>Situation documents for tests.</summary>
internal static class SituationDocuments
{
    /// <summary>A minimal valid document (the same as the frontend validator's tests use).</summary>
    public static JsonObject Minimal(string title = "", string fieldType = "full") => new()
    {
        ["format"] = "tacticalboard.situation",
        ["formatVersion"] = 3,
        ["situation"] = new JsonObject
        {
            ["id"] = "s",
            ["title"] = title,
            ["description"] = "",
            ["sport"] = "floorball",
            ["fieldType"] = fieldType,
            ["createdAt"] = "2026-01-01T00:00:00.000Z",
            ["updatedAt"] = "2026-01-01T00:00:00.000Z",
            ["frames"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = "f1",
                    ["description"] = "",
                    ["elements"] = new JsonArray
                    {
                        new JsonObject { ["id"] = "e1", ["type"] = "Player", ["color"] = "red", ["x"] = 0, ["y"] = 0, ["label"] = "" },
                    },
                },
            },
        },
    };

    public static JsonElement Element(JsonNode node) => JsonDocument.Parse(node.ToJsonString()).RootElement.Clone();

    public static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    /// <summary>A valid, parsed document.</summary>
    public static SituationDocument Valid(string title = "", string fieldType = "full")
    {
        Assert.True(SituationDocument.TryParse(Element(Minimal(title, fieldType)), out var document, out var issues), string.Join("; ", issues));
        return document;
    }

    /// <summary>The frontend's test fixture of a file format version (shared, so both validators are checked against the same files).</summary>
    public static string FrontendFixture(int version)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !Directory.Exists(Path.Combine(directory.FullName, "frontend")))
        {
            directory = directory.Parent;
        }

        Assert.NotNull(directory);
        return File.ReadAllText(Path.Combine(directory.FullName, "frontend", "src", "lib", "model", "serialization", "__fixtures__", $"situation-v{version}.json"));
    }
}
