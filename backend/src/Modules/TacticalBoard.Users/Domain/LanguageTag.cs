using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;
using TacticalBoard.SharedKernel.Validation;

namespace TacticalBoard.Users.Domain;

/// <summary>
/// A user's preferred UI language (arc42 ch. 8.18): a BCP 47 language tag such as <c>de</c> or
/// <c>de-CH</c>, stored in lower case, at most <see cref="MaxLength"/> characters. The backend
/// checks only the form, not which languages the frontend has: adding a language to the frontend
/// needs no backend change; the frontend ignores an account language it has no translation for.
/// </summary>
internal sealed partial record LanguageTag
{
    /// <summary>The longest tag accepted (a technical limit, the column is <c>varchar(35)</c>).</summary>
    public const int MaxLength = 35;

    private LanguageTag(string value) => Value = value;

    /// <summary>The tag in lower case, e.g. <c>de-ch</c>.</summary>
    public string Value { get; }

    /// <summary>Validates a tag from a request; <paramref name="error"/> carries a stable code (arc42 ch. 8.2).</summary>
    public static bool TryCreate(string? input, [NotNullWhen(true)] out LanguageTag? tag, [NotNullWhen(false)] out FieldError? error)
    {
        tag = null;
        var trimmed = input?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            error = FieldError.Required("The language must not be empty.");
            return false;
        }

        if (trimmed.Length > MaxLength || !Pattern().IsMatch(trimmed))
        {
            error = FieldError.Of("unsupported-language", "The language must be a language tag such as \"de\" or \"en\".");
            return false;
        }

        error = null;
#pragma warning disable CA1308 // Language tags are case-insensitive; lower case is their canonical stored form here.
        tag = new LanguageTag(trimmed.ToLowerInvariant());
#pragma warning restore CA1308
        return true;
    }

    /// <summary>Restores a tag that was validated before (e.g. loaded from the database).</summary>
    public static LanguageTag FromTrusted(string value)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(value);
        return new LanguageTag(value);
    }

    /// <inheritdoc />
    public override string ToString() => Value;

    // A primary language subtag of 2–3 letters, then any subtags of 1–8 letters or digits.
    [GeneratedRegex("^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$", RegexOptions.CultureInvariant)]
    private static partial Regex Pattern();
}
