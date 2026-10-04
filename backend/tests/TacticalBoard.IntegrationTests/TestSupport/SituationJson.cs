using System.Text.Json.Nodes;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>Situation documents (file format, arc42 ch. 8.3) for API tests.</summary>
internal static class SituationJson
{
    /// <summary>A valid situation document in the current file format.</summary>
    public static JsonObject Document(string title = "Powerplay", string fieldType = "full") => new()
    {
        ["format"] = "tacticalboard.situation",
        ["formatVersion"] = 3,
        ["situation"] = new JsonObject
        {
            ["id"] = "local-id",
            ["title"] = title,
            ["description"] = "Markdown",
            ["sport"] = "floorball",
            ["fieldType"] = fieldType,
            ["createdAt"] = "2020-01-01T00:00:00.000Z",
            ["updatedAt"] = "2020-01-01T00:00:00.000Z",
            ["frames"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = "f1",
                    ["description"] = "",
                    ["elements"] = new JsonArray
                    {
                        new JsonObject { ["id"] = "p1", ["type"] = "Player", ["color"] = "red", ["x"] = 1200.5, ["y"] = 300, ["label"] = "C" },
                        new JsonObject
                        {
                            ["id"] = "a1",
                            ["type"] = "Pass",
                            ["color"] = "black",
                            ["start"] = new JsonObject { ["x"] = 1, ["y"] = 2 },
                            ["end"] = new JsonObject { ["x"] = 3, ["y"] = 4 },
                            ["bends"] = new JsonArray(new JsonObject { ["x"] = 2, ["y"] = 3 }),
                        },
                    },
                },
            },
        },
    };
}
