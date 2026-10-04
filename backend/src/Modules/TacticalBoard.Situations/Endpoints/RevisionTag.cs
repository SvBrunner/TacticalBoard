using System.Globalization;

namespace TacticalBoard.Situations.Endpoints;

/// <summary>
/// The revision number as an HTTP entity tag (arc42 ch. 8.15): <c>ETag: "7"</c> on responses,
/// <c>If-Match: "7"</c> on saves. A weak tag (<c>W/"7"</c>) is accepted too.
/// </summary>
internal static class RevisionTag
{
    /// <summary>The entity tag of <paramref name="revision"/>.</summary>
    public static string Format(int revision) => "\"" + revision.ToString(CultureInfo.InvariantCulture) + "\"";

    /// <summary>Reads the revision from a single entity tag.</summary>
    public static bool TryParse(string? value, out int revision)
    {
        revision = 0;
        var tag = value?.Trim() ?? string.Empty;
        if (tag.StartsWith("W/", StringComparison.Ordinal))
        {
            tag = tag[2..];
        }

        return tag.Length >= 3
            && tag[0] == '"'
            && tag[^1] == '"'
            && int.TryParse(tag.AsSpan(1, tag.Length - 2), NumberStyles.None, CultureInfo.InvariantCulture, out revision)
            && revision >= 1;
    }
}
