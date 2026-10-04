using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.Extensions.Options;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// Reads <c>end_session_endpoint</c> from the IdP's discovery document (cached by the OIDC
/// handler). If the IdP can't be reached, the logout stays local.
/// </summary>
public sealed partial class DiscoveryEndSessionSupport(
    IOptionsMonitor<OpenIdConnectOptions> options,
    ILogger<DiscoveryEndSessionSupport> logger) : IEndSessionSupport
{
    /// <inheritdoc />
    public async Task<bool> IsSupportedAsync(CancellationToken cancellationToken)
    {
        var configurationManager = options.Get(OpenIdConnectDefaults.AuthenticationScheme).ConfigurationManager;
        if (configurationManager is null)
        {
            return false;
        }

        try
        {
            var configuration = await configurationManager.GetConfigurationAsync(cancellationToken);
            return !string.IsNullOrEmpty(configuration.EndSessionEndpoint);
        }
#pragma warning disable CA1031 // Any discovery failure means: log out locally only.
        catch (Exception exception) when (exception is not OperationCanceledException)
#pragma warning restore CA1031
        {
            LogDiscoveryFailed(logger, exception);
            return false;
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "The identity provider's discovery document could not be read; logging out locally only.")]
    private static partial void LogDiscoveryFailed(ILogger logger, Exception exception);
}
