using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using TacticalBoard.SharedKernel.Validation;

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
/// Every issue also has a stable code (<see cref="Issues"/>, arc42 ch. 8.2) that the frontend words.
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
        void Report(string path, FieldError error) => issues.Add(new DocumentIssue(path, error));

        if (root.ValueKind != JsonValueKind.Object)
        {
            Report("(root)", Issues.ExpectedObject());
            return issues;
        }

        if (StringOf(root, "format") != SituationDocument.Format)
        {
            Report("format", Issues.ExpectedValue(SituationDocument.Format));
        }

        var version = Property(root, "formatVersion");
        if (!IsPositiveInteger(version))
        {
            Report("formatVersion", Issues.ExpectedPositiveInteger());
        }
        else if (version!.Value.GetDouble() != SituationDocument.CurrentFormatVersion)
        {
            Report("formatVersion", Issues.ExpectedCurrentVersion(SituationDocument.CurrentFormatVersion));
        }

        var situation = Property(root, "situation");
        if (situation?.ValueKind != JsonValueKind.Object)
        {
            Report("situation", Issues.ExpectedObject());
            return issues;
        }

        ValidateSituation(situation.Value, "situation", Report);
        return issues;
    }

    private static void ValidateSituation(JsonElement situation, string path, Action<string, FieldError> report)
    {
        CheckNonEmptyString(situation, "id", path, report);
        CheckString(situation, "title", path, report);
        CheckString(situation, "description", path, report);
        if (!Sports.Contains(StringOf(situation, "sport")))
        {
            report($"{path}.sport", Issues.ExpectedSupportedSport());
        }

        if (!FieldTypes.Contains(StringOf(situation, "fieldType")))
        {
            report($"{path}.fieldType", Issues.ExpectedFieldType());
        }

        CheckTimestamp(situation, "createdAt", path, report);
        CheckTimestamp(situation, "updatedAt", path, report);

        var frames = Property(situation, "frames");
        if (frames?.ValueKind != JsonValueKind.Array)
        {
            report($"{path}.frames", Issues.ExpectedArray());
            return;
        }

        if (frames.Value.GetArrayLength() == 0)
        {
            report($"{path}.frames", Issues.ExpectedFrame());
            return;
        }

        var seenFrameIds = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        foreach (var frame in frames.Value.EnumerateArray())
        {
            var framePath = $"{path}.frames[{index++}]";
            if (frame.ValueKind != JsonValueKind.Object)
            {
                report(framePath, Issues.ExpectedObject());
                continue;
            }

            var id = StringOf(frame, "id");
            if (!string.IsNullOrEmpty(id) && !seenFrameIds.Add(id))
            {
                report($"{framePath}.id", Issues.DuplicateFrameId(id));
            }

            ValidateFrame(frame, framePath, report);
        }
    }

    private static void ValidateFrame(JsonElement frame, string path, Action<string, FieldError> report)
    {
        CheckNonEmptyString(frame, "id", path, report);
        CheckString(frame, "description", path, report);

        var elements = Property(frame, "elements");
        if (elements?.ValueKind != JsonValueKind.Array)
        {
            report($"{path}.elements", Issues.ExpectedArray());
            return;
        }

        var seenElementIds = new HashSet<string>(StringComparer.Ordinal);
        var index = 0;
        foreach (var element in elements.Value.EnumerateArray())
        {
            var elementPath = $"{path}.elements[{index++}]";
            if (element.ValueKind != JsonValueKind.Object)
            {
                report(elementPath, Issues.ExpectedObject());
                continue;
            }

            var id = StringOf(element, "id");
            if (!string.IsNullOrEmpty(id) && !seenElementIds.Add(id))
            {
                report($"{elementPath}.id", Issues.DuplicateElementId(id));
            }

            ValidateElement(element, elementPath, report);
        }
    }

    /// <summary>
    /// Arrow types have <c>start</c>, <c>end</c> and <c>bends</c>; every other type (also an
    /// unknown one, so its other problems are reported too) is checked as a point element.
    /// </summary>
    private static void ValidateElement(JsonElement element, string path, Action<string, FieldError> report)
    {
        CheckNonEmptyString(element, "id", path, report);
        var type = StringOf(element, "type");
        if (!PointElementTypes.Contains(type) && !ArrowElementTypes.Contains(type))
        {
            report($"{path}.type", Issues.ExpectedElementType());
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

    private static void ValidatePointElement(JsonElement element, string path, Action<string, FieldError> report)
    {
        CheckFiniteNumber(Property(element, "x"), $"{path}.x", report);
        CheckFiniteNumber(Property(element, "y"), $"{path}.y", report);
        var label = Property(element, "label");
        if (label?.ValueKind != JsonValueKind.String || !IsValidLabel(label.Value.GetString()!))
        {
            report($"{path}.label", Issues.ExpectedLabel());
        }
    }

    private static void ValidateArrow(JsonElement element, string path, Action<string, FieldError> report)
    {
        CheckPoint(Property(element, "start"), $"{path}.start", report);
        CheckPoint(Property(element, "end"), $"{path}.end", report);
        var bends = Property(element, "bends");
        if (bends?.ValueKind != JsonValueKind.Array)
        {
            report($"{path}.bends", Issues.ExpectedArray());
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

    private static void CheckString(JsonElement owner, string name, string path, Action<string, FieldError> report)
    {
        if (Property(owner, name)?.ValueKind != JsonValueKind.String)
        {
            report($"{path}.{name}", Issues.ExpectedString());
        }
    }

    private static void CheckNonEmptyString(JsonElement owner, string name, string path, Action<string, FieldError> report)
    {
        if (string.IsNullOrEmpty(StringOf(owner, name)))
        {
            report($"{path}.{name}", Issues.ExpectedNonEmptyString());
        }
    }

    private static void CheckFiniteNumber(JsonElement? value, string path, Action<string, FieldError> report)
    {
        if (value is not { ValueKind: JsonValueKind.Number } number || !number.TryGetDouble(out var parsed) || !double.IsFinite(parsed))
        {
            report(path, Issues.ExpectedFiniteNumber());
        }
    }

    private static void CheckPoint(JsonElement? value, string path, Action<string, FieldError> report)
    {
        if (value?.ValueKind != JsonValueKind.Object)
        {
            report(path, Issues.ExpectedPoint());
            return;
        }

        CheckFiniteNumber(Property(value.Value, "x"), $"{path}.x", report);
        CheckFiniteNumber(Property(value.Value, "y"), $"{path}.y", report);
    }

    private static void CheckTimestamp(JsonElement owner, string name, string path, Action<string, FieldError> report)
    {
        var value = StringOf(owner, name);
        if (value is null
            || !IsoTimestamp().IsMatch(value)
            || !DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out _))
        {
            report($"{path}.{name}", Issues.ExpectedTimestamp());
        }
    }

    // Same pattern as the frontend (with ASCII digits only, as in JavaScript).
    [GeneratedRegex(@"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?(Z|[+-][0-9]{2}:[0-9]{2})$", RegexOptions.CultureInvariant)]
    private static partial Regex IsoTimestamp();

    /// <summary>The issues with their stable codes and English messages (the frontend's messages).</summary>
    internal static class Issues
    {
        public static FieldError ExpectedObject() => FieldError.Of("expected-object", "expected object");

        public static FieldError ExpectedValue(string expected) =>
            FieldError.Of("expected-value", $"expected \"{expected}\"", ("expected", expected));

        public static FieldError ExpectedPositiveInteger() => FieldError.Of("expected-positive-integer", "expected positive integer");

        public static FieldError ExpectedCurrentVersion(int version) =>
            FieldError.Of("expected-current-version", $"expected {version} (the current format version)", ("version", version));

        public static FieldError ExpectedSupportedSport() => FieldError.Of("expected-supported-sport", "expected supported sport");

        public static FieldError ExpectedFieldType() => FieldError.Of("expected-field-type", "expected \"full\" or \"half\"");

        public static FieldError ExpectedArray() => FieldError.Of("expected-array", "expected array");

        public static FieldError ExpectedFrame() => FieldError.Of("expected-frame", "expected at least one frame");

        public static FieldError DuplicateFrameId(string id) => FieldError.Of("duplicate-id", $"duplicate frame id \"{id}\"", ("id", id));

        public static FieldError DuplicateElementId(string id) =>
            FieldError.Of("duplicate-id", $"duplicate element id \"{id}\" in frame", ("id", id));

        public static FieldError ExpectedElementType() => FieldError.Of("expected-element-type", "expected known element type");

        public static FieldError ExpectedLabel() => FieldError.Of("expected-label", "expected string of at most 2 letters or digits");

        public static FieldError ExpectedString() => FieldError.Of("expected-string", "expected string");

        public static FieldError ExpectedNonEmptyString() => FieldError.Of("expected-non-empty-string", "expected non-empty string");

        public static FieldError ExpectedFiniteNumber() => FieldError.Of("expected-finite-number", "expected finite number");

        public static FieldError ExpectedPoint() => FieldError.Of("expected-point", "expected object with x and y");

        public static FieldError ExpectedTimestamp() => FieldError.Of("expected-timestamp", "expected ISO 8601 timestamp");
    }
}
