using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Users.Domain;

/// <summary>
/// A local user account, mapped from an identity provider login (issuer + subject). Created on
/// the first login (just in time) as a normal user; the display name is taken from the IdP only
/// then and afterwards changed only in the app (arc42 ch. 1, 8.13).
/// </summary>
internal sealed class User : SoftDeletableEntity
{
    // Parameter names match the properties, so EF Core materializes through this constructor.
    private User(Guid id, string issuer, string subject, string displayNameValue, DateTimeOffset createdAt)
    {
        Id = id;
        Issuer = issuer;
        Subject = subject;
        DisplayNameValue = displayNameValue;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    /// <summary>The identity provider's issuer (<c>iss</c>).</summary>
    public string Issuer { get; private set; }

    /// <summary>The subject at the identity provider (<c>sub</c>).</summary>
    public string Subject { get; private set; }

    /// <summary>The identity this account is mapped from.</summary>
    public ExternalIdentity Identity => new(Issuer, Subject);

    /// <summary>The stored display name (persisted column).</summary>
    public string DisplayNameValue { get; private set; }

    public DisplayName DisplayName => DisplayName.FromTrusted(DisplayNameValue);

    public bool IsSystemAdministrator { get; private set; }

    /// <summary>The UI language the user chose (arc42 ch. 8.18), or <c>null</c> if they never chose one (persisted column).</summary>
    public string? PreferredLanguageValue { get; private set; }

    /// <summary>The UI language the user chose, or <c>null</c>.</summary>
    public LanguageTag? PreferredLanguage => PreferredLanguageValue is null ? null : LanguageTag.FromTrusted(PreferredLanguageValue);

    /// <summary>A blocked user can't log in or call the API (arc42 ch. 8.1).</summary>
    public bool IsBlocked { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>Whether the user may have a session: neither blocked nor deleted.</summary>
    public bool CanSignIn => !IsBlocked && !IsDeleted;

    /// <summary>A new normal user (not a system administrator, not blocked).</summary>
    public static User Register(Guid id, ExternalIdentity identity, DisplayName displayName, DateTimeOffset createdAt)
    {
        ArgumentNullException.ThrowIfNull(identity);
        ArgumentNullException.ThrowIfNull(displayName);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        return new User(id, identity.Issuer, identity.Subject, displayName.Value, createdAt);
    }

    public void ChangeDisplayName(DisplayName displayName)
    {
        ArgumentNullException.ThrowIfNull(displayName);
        DisplayNameValue = displayName.Value;
    }

    /// <summary>Stores the UI language the user chose; it applies on their next logins too.</summary>
    public void ChangePreferredLanguage(LanguageTag language)
    {
        ArgumentNullException.ThrowIfNull(language);
        PreferredLanguageValue = language.Value;
    }

    public void GrantSystemAdministrator() => IsSystemAdministrator = true;

    public void Block() => IsBlocked = true;
}
