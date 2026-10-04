namespace TacticalBoard.Api.Authentication;

/// <summary>
/// The OpenID Connect identity provider (configuration section <c>Oidc</c>, e.g. <c>Oidc__Authority</c>).
/// Any standard OIDC provider works (ADR-003); nothing here is specific to one product.
/// </summary>
public sealed class OidcSettings
{
    /// <summary>The configuration section.</summary>
    public const string SectionName = "Oidc";

    /// <summary>The scopes requested by default.</summary>
    public const string DefaultScope = "openid profile email";

    /// <summary>The issuer URL, e.g. <c>https://id.example.org/realms/tacticalboard</c>. Required.</summary>
    public Uri? Authority { get; set; }

    /// <summary>
    /// Where the backend fetches the discovery document, if not
    /// <c>{Authority}/.well-known/openid-configuration</c> (e.g. an internal container address).
    /// </summary>
    public Uri? MetadataAddress { get; set; }

    /// <summary>Whether discovery must use HTTPS. Default <c>true</c>; only for local development set to <c>false</c>.</summary>
    public bool RequireHttpsMetadata { get; set; } = true;

    /// <summary>The client ID registered at the IdP. Required.</summary>
    public string ClientId { get; set; } = string.Empty;

    /// <summary>The client secret (confidential client); empty for a public client with PKCE only.</summary>
    public string? ClientSecret { get; set; }

    /// <summary>Space-separated scopes; must contain <c>openid</c>. Default <see cref="DefaultScope"/>.</summary>
    public string Scope { get; set; } = DefaultScope;

    /// <summary>The scopes as a list.</summary>
    public IReadOnlyList<string> Scopes =>
        Scope.Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
