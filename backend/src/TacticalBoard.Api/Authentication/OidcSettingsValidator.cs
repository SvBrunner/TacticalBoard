using Microsoft.Extensions.Options;

namespace TacticalBoard.Api.Authentication;

/// <summary>Checks <see cref="OidcSettings"/> when the app starts, so a misconfigured login fails fast.</summary>
public sealed class OidcSettingsValidator : IValidateOptions<OidcSettings>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, OidcSettings options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var failures = new List<string>();

        if (!IsAbsoluteHttpUrl(options.Authority))
        {
            failures.Add("Oidc:Authority must be an absolute http or https URL (the IdP's issuer).");
        }

        if (options.MetadataAddress is not null && !IsAbsoluteHttpUrl(options.MetadataAddress))
        {
            failures.Add("Oidc:MetadataAddress must be an absolute http or https URL.");
        }

        if (string.IsNullOrWhiteSpace(options.ClientId))
        {
            failures.Add("Oidc:ClientId is required.");
        }

        if (!options.Scopes.Contains("openid", StringComparer.Ordinal))
        {
            failures.Add("Oidc:Scope must contain 'openid'.");
        }

        return failures.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(failures);
    }

    private static bool IsAbsoluteHttpUrl(Uri? url) =>
        url is { IsAbsoluteUri: true } && (url.Scheme == Uri.UriSchemeHttp || url.Scheme == Uri.UriSchemeHttps);
}
