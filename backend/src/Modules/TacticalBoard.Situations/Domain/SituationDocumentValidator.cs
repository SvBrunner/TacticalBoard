using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TacticalBoard.Situations.Domain;

/// <summary>
/// Checks that a JSON document is a situation in the <b>current</b> file format (arc42 ch. 8.3,
/// format version <see cref="SituationDocument.CurrentFormatVersion"/>). Reports every problem at
/// once; unknown extra properties are ignored.
/// <para>
/// This is a port of the frontend's <c>SituationFileValidator</c>
/// (<c>frontend/src/lib/model/serialization/SituationFileValidator.ts</c>) with the same paths and
/// messages. <b>Keep the two in sync</b>: a format change updates both (ch. 8.3). The only
/// difference: the frontend validates after migrating older versions, so it accepts any positive
/// <c>formatVersion</c>; the backend stores the current version only (ADR-009) and rejects others.
/// </para>
/// </summary>
internal sealed partial class SituationDocumentValidator
{
    private static readonly string[] Sports = ["floorball"];
    private static readonly string[] FieldTypes = ["full", "half"];
    private static readonly string[] PointElementTypes = ["Player", "Ball", "Rectangle", "Triangle", "Circle"];
    private static readonly string[] ArrowElementTypes = ["Pass", "Run", "Shot"];

    /// <summary>The longest position label, in characters (Unicode code points).</summary>
    public const int MaxLabelLength = 2;

    /// <summary>All problems of <paramref name="root"/>; empty when it is a valid current-format document.</summary>
    public IReadOnlyList<DocumentIssue> Validate(JsonElement root)
    {
        var issues = new List<DocumentIssue>();
        void Report(string path, string message) => issues.Add(new DocumentIssue(path, message));

        if (root.ValueKind != JsonValueKind.Object)
        {
            Report("(root)", "expected object");
            return issues;
        }

        if (StringOf(root, "format") != SituationDocument.Format)
        {
            Report("format", $"expected \"{SituationDocument.Format}\"");
        }

        var version = Property(root, "formatVersion");
        if (!IsPositiveInteger(version))
        {
            Report("formatVersion", "expected positive integer");
        }
        else if (version!.Value.GetDouble() != SituationDocument.CurrentFormatVersion)
        {
            Report("formatVersion", $"expected {SituationDocument.CurrentFormatVersion} (the current format version)");
        }

        var situation = Property(root, "situation");
        if (situation?.ValueKind != JsonValueKind.Object)
        {
            Report("situation", "expected object");
            return issues;
        }

        ValidateSituation(situation.Value, "situation", Report);
        return issues;
    }

    private static void ValidateSituation(JsonElement situation, string path, Action<string, string> report)
    {
        CheckNonEmptyString(situation, "id", path, report);
        CheckString(situation, "title", path, report);
        CheckString(situation, "description", path, report);
        if (!Sports.Contains(StringOf(situation, "sport")))
        {
            report($"{path}.sport", "expected supported sport");
        }

        if (!FieldTypes.Contains(StringOf(situation, "fieldType")))
        {
            report($"{path}.fieldType", "expected \"full\" or \"half\"");
        }

        CheckTimestamp(situation, "createdAt", path, report);
        CheckTimestamp(situation, "updatedAt", path, report);

        var frames = Property(situation, "frames");
        if (frames?.ValueKind != JsonValueKind.Array)
        {
            report($"{path}.frames", "expected array");
            return;
        }

        if (frames.Value.GetArrayLength() == 0)
        {
            report($"{path}.frames", "expected at least one frame");
            return;
        }

        var seenFrameIds = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        foreach (var frame in frames.Value.EnumerateArray())
        {
            var framePath = $"{path}.frames[{index++}]";
            if (frame.ValueKind != JsonValueKind.Object)
            {
                report(framePath, "expected object");
                continue;
            }

            var id = StringOf(frame, "id");
            if (!string.IsNullOrEmpty(id) && !seenFrameIds.Add(id))
            {
                report($"{framePath}.id", $"duplicate frame id \"{id}\"");
            }

            ValidateFrame(frame, framePath, report);
        }
    }

    private static void ValidateFrame(JsonElement frame, string path, Action<string, string> report)
    {
        CheckNonEmptyString(frame, "id", path, report);
        CheckString(frame, "description", path, report);

        var elements = Property(frame, "elements");
        if (elements?.ValueKind != JsonValueKind.Array)
        {
            report($"{path}.elements", "expected array");
            return;
        }

        var seenElementIds = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        foreach (var element in elements.Value.EnumerateArray())
        {
            var elementPath = $"{path}.elements[{index++}]";
            if (element.ValueKind != JsonValueKind.Object)
            {
                report(elementPath, "expected object");
                continue;
            }

            var id = StringOf(element, "id");
            if (!string.IsNullOrEmpty(id) && !seenElementIds.Add(id))
            {
                report($"{elementPath}.id", $"duplicate element id \"{id}\" in frame");
            }

            ValidateElement(element, elementPath, report);
        }
    }

    /// <summary>
    /// Arrow types have <c>start</c>, <c>end</c> and <c>bends</c>; every other type (also an
    /// unknown one, so its other problems are reported too) is checked as a point element.
    /// </summary>
    private static void ValidateElement(JsonElement element, string path, Action<string, string> report)
    {
        CheckNonEmptyString(element, "id", path, report);
        var type = StringOf(element, "type");
        if (!PointElementTypes.Contains(type) && !ArrowElementTypes.Contains(type))
        {
            report($"{path}.type", "expected known element type");
        }

        CheckNonEmptyString(element, "color", path, report);
        if (ArrowElementTypes.Contains(type))
        {
            ValidateArrow(element, path, report);
        }
        else
        {
            ValidatePointElement(element, path, report);
        }
    }

    private static void ValidatePointElement(JsonElement element, string path, Action<string, string> report)
    {
        CheckFiniteNumber(Property(element, "x"), $"{path}.x", report);
        CheckFiniteNumber(Property(element, "y"), $"{path}.y", report);
        var label = Property(element, "label");
        if (label?.ValueKind != JsonValueKind.String || !IsValidLabel(label.Value.GetString()!))
        {
            report($"{path}.label", "expected string of at most 2 letters or digits");
        }
    }

    private static void ValidateArrow(JsonElement element, string path, Action<string, string> report)
    {
        CheckPoint(Property(element, "start"), $"{path}.start", report);
        CheckPoint(Property(element, "end"), $"{path}.end", report);
        var bends = Property(element, "bends");
        if (bends?.ValueKind != JsonValueKind.Array)
        {
            report($"{path}.bends", "expected array");
            return;
        }

        var index = 0;
        foreach (var bend in bends.Value.EnumerateArray())
        {
            CheckPoint(bend, $"{path}.bends[{index++}]", report);
        }
    }

    /// <summary>
    /// A position label (ch. 8.3, the frontend's <c>PositionCatalog.isValidLabel</c>): <c>""</c>,
    /// or at most <see cref="MaxLabelLength"/> characters, each a letter or a decimal digit.
    /// </summary>
    public static bool IsValidLabel(string label)
    {
        ArgumentNullException.ThrowIfNull(label);
        var count = 0;
        foreach (var character in label.EnumerateRunes())
        {
            if (++count > MaxLabelLength || !(Rune.IsLetter(character) || Rune.GetUnicodeCategory(character) == UnicodeCategory.DecimalDigitNumber))
            {
                return false;
            }
        }

        return true;
    }

    private static JsonElement? Property(JsonElement owner, string name) =>
        owner.TryGetProperty(name, out var value) ? value : null;

    private static string? StringOf(JsonElement owner, string name) =>
        Property(owner, name) is { ValueKind: JsonValueKind.String } value ? value.GetString() : null;

    private static bool IsPositiveInteger(JsonElement? value) =>
        value is { ValueKind: JsonValueKind.Number } number
        && number.TryGetDouble(out var parsed) && double.IsFinite(parsed) && Math.Floor(parsed) == parsed && parsed > 0;

    private static void CheckString(JsonElement owner, string name, string path, Action<string, string> report)
    {
        if (Property(owner, name)?.ValueKind != JsonValueKind.String)
        {
            report($"{path}.{name}", "expected string");
        }
    }

    private static void CheckNonEmptyString(JsonElement owner, string name, string path, Action<string, string> report)
    {
        if (string.IsNullOrEmpty(StringOf(owner, name)))
        {
            report($"{path}.{name}", "expected non-empty string");
        }
    }

    private static void CheckFiniteNumber(JsonElement? value, string path, Action<string, string> report)
    {
        if (value is not { ValueKind: JsonValueKind.Number } number || !number.TryGetDouble(out var parsed) || !double.IsFinite(parsed))
        {
            report(path, "expected finite number");
        }
    }

    private static void CheckPoint(JsonElement? value, string path, Action<string, string> report)
    {
        if (value?.ValueKind != JsonValueKind.Object)
        {
            report(path, "expected object with x and y");
            return;
        }

        CheckFiniteNumber(Property(value.Value, "x"), $"{path}.x", report);
        CheckFiniteNumber(Property(value.Value, "y"), $"{path}.y", report);
    }

    private static void CheckTimestamp(JsonElement owner, string name, string path, Action<string, string> report)
    {
        var value = StringOf(owner, name);
        if (value is null
            || !IsoTimestamp().IsMatch(value)
            || !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _))
        {
            report($"{path}.{name}", "expected ISO 8601 timestamp");
        }
    }

    // Same pattern as the frontend (with ASCII digits only, as in JavaScript).
    [GeneratedRegex(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$", RegexOptions.CultureInvariant)]
    private static partial Regex IsoTimestamp();
}
