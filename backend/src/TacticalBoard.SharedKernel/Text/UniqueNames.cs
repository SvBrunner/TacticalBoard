using System.Text;

namespace TacticalBoard.SharedKernel.Text;

/// <summary>
/// How names that must be unique within a scope are compared (arc42 ch. 8.15, 8.16): situation
/// titles and folder names per area (team names later). Two names are the same if their
/// <see cref="Normalize"/> forms are equal: surrounding whitespace and upper/lower case are ignored,
/// and equivalent Unicode spellings (composed/decomposed accents) count as one.
/// </summary>
public static class UniqueNames
{
    /// <summary>The comparison form of <paramref name="text"/>: trimmed, Unicode NFC, upper-cased invariantly.</summary>
    public static string Normalize(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        return text.Trim().Normalize(NormalizationForm.FormC).ToUpperInvariant();
    }
}
