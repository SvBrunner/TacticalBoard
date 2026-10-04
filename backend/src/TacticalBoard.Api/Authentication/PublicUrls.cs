using Microsoft.Extensions.Options;
using TacticalBoard.Api.Configuration;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// Absolute URLs under <c>App:PublicBaseUrl</c>, for the URLs the IdP redirects the browser to.
/// Without a configured base URL the OIDC handler derives them from the request.
/// </summary>
public sealed class PublicUrls(IOptions<AppOptions> options)
{
    /// <summary>The public URL of <paramref name="path"/>, or <c>null</c> when no public base URL is configured.</summary>
    public string? For(string path)
    {
        ArgumentException.ThrowIfNullOrEmpty(path);
        var baseUrl = options.Value.PublicBaseUrl;
        return baseUrl is null ? null : baseUrl.AbsoluteUri.TrimEnd('/') + path;
    }
}
