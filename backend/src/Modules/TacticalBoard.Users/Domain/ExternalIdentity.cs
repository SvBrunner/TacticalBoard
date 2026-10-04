namespace TacticalBoard.Users.Domain;

/// <summary>
/// Who a user is at the identity provider: the issuer (the IdP's <c>iss</c>) and the subject
/// (<c>sub</c>), compared exactly (ordinal). Users are identified by this pair, never by e-mail (ADR-003).
/// </summary>
internal sealed record ExternalIdentity
{
    /// <summary>The longest subject OpenID Connect allows (Core 1.0, section 2: at most 255 ASCII characters).</summary>
    public const int MaxSubjectLength = 255;

    /// <summary>The longest issuer accepted (a URL).</summary>
    public const int MaxIssuerLength = 2048;

    /// <summary>The separator in the configuration format <c>issuer|subject</c>.</summary>
    public const char Separator = '|';

    public ExternalIdentity(string issuer, string subject)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(subject);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(issuer.Length, MaxIssuerLength, nameof(issuer));
        ArgumentOutOfRangeException.ThrowIfGreaterThan(subject.Length, MaxSubjectLength, nameof(subject));
        Issuer = issuer;
        Subject = subject;
    }

    public string Issuer { get; }

    /// <summary>Whether <paramref name="issuer"/> and <paramref name="subject"/> form a valid identity.</summary>
    public static bool IsValid(string? issuer, string? subject) =>
        !string.IsNullOrWhiteSpace(issuer) && !string.IsNullOrWhiteSpace(subject)
        && issuer.Length <= MaxIssuerLength && subject.Length <= MaxSubjectLength;

    public string Subject { get; }

    /// <summary>
    /// Parses <c>issuer|subject</c> (surrounding whitespace ignored). The issuer is everything
    /// before the first <c>|</c>, the subject everything after it.
    /// </summary>
    /// <exception cref="FormatException">The text is not in that format.</exception>
    public static ExternalIdentity Parse(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var trimmed = text.Trim();
        var separator = trimmed.IndexOf(Separator, StringComparison.Ordinal);
        if (separator <= 0 || separator == trimmed.Length - 1)
        {
            throw new FormatException($"'{text}' is not in the format 'issuer{Separator}subject'.");
        }

        var issuer = trimmed[..separator].Trim();
        var subject = trimmed[(separator + 1)..].Trim();
        if (!IsValid(issuer, subject))
        {
            throw new FormatException($"'{text}' is not in the format 'issuer{Separator}subject'.");
        }

        return new ExternalIdentity(issuer, subject);
    }

    /// <inheritdoc />
    public override string ToString() => Issuer + Separator + Subject;
}
