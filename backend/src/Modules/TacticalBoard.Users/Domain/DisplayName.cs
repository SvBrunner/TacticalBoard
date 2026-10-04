using System.Diagnostics.CodeAnalysis;

namespace TacticalBoard.Users.Domain;

/// <summary>
/// A user's display name: trimmed, not empty, at most <see cref="MaxLength"/> characters
/// (UTF-16 code units, the same unit the browser's <c>maxlength</c> counts), no control characters.
/// Display names are not unique.
/// </summary>
internal sealed record DisplayName
{
    /// <summary>The maximum length (a technical limit, arc42 ch. 8.13).</summary>
    public const int MaxLength = 100;

    /// <summary>Used when the identity provider sends none of the name claims.</summary>
    public const string Fallback = "User";

    private DisplayName(string value) => Value = value;

    public string Value { get; }

    /// <summary>Validates a name the user entered.</summary>
    /// <param name="input">The raw input.</param>
    /// <param name="displayName">The valid name (trimmed), when the result is <c>true</c>.</param>
    /// <param name="error">Why the input is invalid, when the result is <c>false</c>.</param>
    public static bool TryCreate(string? input, [NotNullWhen(true)] out DisplayName? displayName, [NotNullWhen(false)] out string? error)
    {
        displayName = null;
        var trimmed = input?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            error = "The display name must not be empty.";
            return false;
        }

        if (trimmed.Length > MaxLength)
        {
            error = $"The display name must be at most {MaxLength} characters long.";
            return false;
        }

        if (trimmed.Any(char.IsControl))
        {
            error = "The display name must not contain control characters.";
            return false;
        }

        error = null;
        displayName = new DisplayName(trimmed);
        return true;
    }

    /// <summary>
    /// The initial display name from the identity provider's claims (arc42 ch. 8.13): the first
    /// non-blank of <c>name</c>, <c>preferred_username</c>, <c>email</c>, made valid (control
    /// characters become spaces, cut to <see cref="MaxLength"/>), or <see cref="Fallback"/>.
    /// </summary>
    public static DisplayName FromIdentityProvider(string? name, string? preferredUsername, string? email)
    {
        foreach (var candidate in new[] { name, preferredUsername, email })
        {
            var sanitized = Sanitize(candidate);
            if (sanitized.Length > 0)
            {
                return new DisplayName(sanitized);
            }
        }

        return new DisplayName(Fallback);
    }

    /// <summary>Restores a name that was validated before (e.g. loaded from the database).</summary>
    public static DisplayName FromTrusted(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        return new DisplayName(value);
    }

    /// <inheritdoc />
    public override string ToString() => Value;

    private static string Sanitize(string? candidate)
    {
        if (candidate is null)
        {
            return string.Empty;
        }

        var text = new string(candidate.Select(character => char.IsControl(character) ? ' ' : character).ToArray()).Trim();
        if (text.Length <= MaxLength)
        {
            return text;
        }

        // Never cut a surrogate pair in half.
        var length = char.IsHighSurrogate(text[MaxLength - 1]) ? MaxLength - 1 : MaxLength;
        return text[..length].TrimEnd();
    }
}
