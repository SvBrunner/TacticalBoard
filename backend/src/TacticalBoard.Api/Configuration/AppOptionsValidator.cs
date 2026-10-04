using Microsoft.Extensions.Options;

namespace TacticalBoard.Api.Configuration;

/// <summary>Checks <see cref="AppOptions"/> when the app starts.</summary>
public sealed class AppOptionsValidator : IValidateOptions<AppOptions>
{
    /// <inheritdoc />
    public ValidateOptionsResult Validate(string? name, AppOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        var url = options.PublicBaseUrl;
        if (url is null)
        {
            return ValidateOptionsResult.Success;
        }

        if (!url.IsAbsoluteUri || (url.Scheme != Uri.UriSchemeHttp && url.Scheme != Uri.UriSchemeHttps))
        {
            return ValidateOptionsResult.Fail("App:PublicBaseUrl must be an absolute http or https URL.");
        }

        if (!string.IsNullOrEmpty(url.Query) || !string.IsNullOrEmpty(url.Fragment))
        {
            return ValidateOptionsResult.Fail("App:PublicBaseUrl must not contain a query or fragment.");
        }

        return ValidateOptionsResult.Success;
    }
}
