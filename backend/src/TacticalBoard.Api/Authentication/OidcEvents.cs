using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// The login's hooks into the OIDC handler: public redirect URIs, mapping the IdP login to a
/// local user (just in time, rejecting blocked users), a session principal that holds only the
/// local user id, and a quiet redirect instead of an error page when a login fails
/// (<c>/?login=blocked</c> for a blocked user, otherwise <c>/?login=failed</c> without a reason).
/// </summary>
public sealed partial class OidcEvents(IUserAuthentication users, PublicUrls publicUrls, ILogger<OidcEvents> logger)
    : OpenIdConnectEvents
{
    /// <inheritdoc />
    public override Task RedirectToIdentityProvider(RedirectContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var redirectUri = publicUrls.For(context.Options.CallbackPath.Value!);
        if (redirectUri is not null)
        {
            context.ProtocolMessage.RedirectUri = redirectUri;
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public override Task RedirectToIdentityProviderForSignOut(RedirectContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var postLogoutRedirectUri = publicUrls.For(context.Options.SignedOutCallbackPath.Value!);
        if (postLogoutRedirectUri is not null)
        {
            context.ProtocolMessage.PostLogoutRedirectUri = postLogoutRedirectUri;
        }

        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public override async Task TicketReceived(TicketReceivedContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var login = context.Principal is null ? null : ExternalLoginMapper.Map(context.Principal);
        if (login is null)
        {
            LogLoginWithoutIdentity(logger);
            Redirect(context, AuthPaths.LoginFailedRedirect);
            return;
        }

        var result = await users.SignInAsync(login, context.HttpContext.RequestAborted);
        if (!result.Succeeded)
        {
            LogLoginRejected(logger, login.Issuer, login.Subject, result.Rejection!.Value);
            Redirect(context, result.Rejection == SignInRejection.Blocked ? AuthPaths.LoginBlockedRedirect : AuthPaths.LoginFailedRedirect);
            return;
        }

        context.Principal = SessionClaims.CreatePrincipal(result.UserId!.Value);
        KeepOnlyIdToken(context.Properties!);
    }

    /// <inheritdoc />
    public override Task RemoteFailure(RemoteFailureContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        LogRemoteFailure(logger, context.Failure);
        context.Response.Redirect(AuthPaths.LoginFailedRedirect);
        context.HandleResponse();
        return Task.CompletedTask;
    }

    /// <summary>
    /// The session needs only the ID token (as <c>id_token_hint</c> for the IdP logout); the
    /// access and refresh tokens are not used, so they are not stored in the cookie.
    /// </summary>
    private static void KeepOnlyIdToken(AuthenticationProperties properties)
    {
        var idToken = properties.GetTokenValue(OpenIdConnectParameterNames.IdToken);
        properties.StoreTokens(idToken is null
            ? []
            : [new AuthenticationToken { Name = OpenIdConnectParameterNames.IdToken, Value = idToken }]);
    }

    private static void Redirect(TicketReceivedContext context, string target)
    {
        context.Response.Redirect(target);
        context.HandleResponse();
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Login rejected: the identity provider sent no subject or issuer.")]
    private static partial void LogLoginWithoutIdentity(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Login of {Issuer}|{Subject} rejected: {Rejection}.")]
    private static partial void LogLoginRejected(ILogger logger, string issuer, string subject, SignInRejection rejection);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Login failed at the identity provider or in the callback.")]
    private static partial void LogRemoteFailure(ILogger logger, Exception? exception);
}
