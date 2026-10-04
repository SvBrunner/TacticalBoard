using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace TacticalBoard.Situations.Domain;

/// <summary>
/// A situation as JSON in the current file format (arc42 ch. 8.3), validated by
/// <see cref="SituationDocumentValidator"/>. The server owns the situation's <c>id</c>,
/// <c>title</c>, <c>createdAt</c> and <c>updatedAt</c>: <see cref="Stamp"/> overwrites them with
/// the values of the situation row, so a stored revision always agrees with its row (ch. 8.15).
/// </summary>
internal sealed class SituationDocument
{
    /// <summary>The <c>format</c> of every situation document.</summary>
    public const string Format = "tacticalboard.situation";

    /// <summary>The file format version the server stores (the frontend's <c>CURRENT_FORMAT_VERSION</c>).</summary>
    public const int CurrentFormatVersion = 3;

    private static readonly SituationDocumentValidator Validator = new();

    private readonly JsonObject _root;

    private SituationDocument(JsonObject root)
    {
        _root = root;
        var situation = root["situation"]!.AsObject();
        Title = situation["title"]!.GetValue<string>();
        Sport = situation["sport"]!.GetValue<string>();
        FieldType = situation["fieldType"]!.GetValue<string>();
    }

    /// <summary>The title as written in the document (may be blank or untrimmed).</summary>
    public string Title { get; }

    /// <summary>The sport, e.g. <c>floorball</c>.</summary>
    public string Sport { get; }

    /// <summary><c>full</c> or <c>half</c>.</summary>
    public string FieldType { get; }

    /// <summary>The format version of every valid document: the current one.</summary>
    public static int FormatVersion => CurrentFormatVersion;

    /// <summary>Validates <paramref name="json"/>; on success <paramref name="document"/> holds a copy of it.</summary>
    public static bool TryParse(JsonElement json, [NotNullWhen(true)] out SituationDocument? document, out IReadOnlyList<DocumentIssue> issues)
    {
        issues = Validator.Validate(json);
        if (issues.Count > 0)
        {
            document = null;
            return false;
        }

        document = new SituationDocument(JsonNode.Parse(json.GetRawText())!.AsObject());
        return true;
    }

    /// <summary>
    /// The document as JSON with the server-owned values: <paramref name="id"/>,
    /// <paramref name="title"/>, and the timestamps (ISO 8601, UTC, milliseconds, as the frontend writes them).
    /// </summary>
    public string Stamp(Guid id, SituationTitle title, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        ArgumentNullException.ThrowIfNull(title);
        var copy = _root.DeepClone().AsObject();
        var situation = copy["situation"]!.AsObject();
        situation["id"] = id.ToString();
        situation["title"] = title.Value;
        situation["createdAt"] = FormatTimestamp(createdAt);
        situation["updatedAt"] = FormatTimestamp(updatedAt);
        return copy.ToJsonString();
    }

    /// <summary>ISO 8601 in UTC with milliseconds, e.g. <c>2026-03-01T10:00:00.000Z</c>.</summary>
    public static string FormatTimestamp(DateTimeOffset value) =>
        value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);
}
