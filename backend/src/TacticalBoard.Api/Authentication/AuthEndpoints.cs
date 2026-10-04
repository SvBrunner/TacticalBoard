using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// <c>GET /auth/login?returnUrl=…</c> and <c>POST /auth/logout</c> (arc42 ch. 8.13). The
/// callback paths are handled by the OIDC handler itself.
/// </summary>
public static class AuthEndpoints
{
    /// <summary>Maps the endpoints.</summary>
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet(AuthPaths.Login, Login);
        app.MapPost(AuthPaths.Logout, LogoutAsync);
    }

    /// <summary>
    /// Starts the Authorization Code flow with PKCE; after the login the browser returns to
    /// <paramref name="returnUrl"/> (a local path, otherwise the start page). Already logged in:
    /// straight to <paramref name="returnUrl"/>.
    /// </summary>
    public static IResult Login(HttpContext httpContext, string? returnUrl)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        var target = ReturnUrlPolicy.Sanitize(returnUrl);
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            return TypedResults.Redirect(target);
        }

        return TypedResults.Challenge(
            new AuthenticationProperties { RedirectUri = target },
            [OpenIdConnectDefaults.AuthenticationScheme]);
    }

    /// <summary>
    /// Ends the session (antiforgery-protected like every POST) and, if the IdP supports it,
    /// continues with the IdP's logout, which redirects back to the start page.
    /// </summary>
    public static async Task<IResult> LogoutAsync(HttpContext httpContext, IEndSessionSupport endSession)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        ArgumentNullException.ThrowIfNull(endSession);
        if (httpContext.User.Identity?.IsAuthenticated != true)
        {
            return TypedResults.Redirect(AuthPaths.Home);
        }

        var properties = new AuthenticationProperties { RedirectUri = AuthPaths.Home };
        if (await endSession.IsSupportedAsync(httpContext.RequestAborted))
        {
            return TypedResults.SignOut(
                properties,
                [CookieAuthenticationDefaults.AuthenticationScheme, OpenIdConnectDefaults.AuthenticationScheme]);
        }

        await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return TypedResults.Redirect(AuthPaths.Home);
    }
}
