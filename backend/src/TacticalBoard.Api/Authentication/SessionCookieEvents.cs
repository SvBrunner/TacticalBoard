using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// The session cookie's behavior: every request checks that the user still exists and is
/// neither blocked nor deleted (one primary-key query), otherwise the session ends at once
/// (arc42 ch. 8.13). API requests without a session get <c>401</c>/<c>403</c> Problem Details
/// (written by the status code pages) instead of a redirect.
/// </summary>
public sealed class SessionCookieEvents(IUserAuthentication users) : CookieAuthenticationEvents
{
    /// <inheritdoc />
    public override async Task ValidatePrincipal(CookieValidatePrincipalContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var userId = SessionClaims.UserId(context.Principal);
        if (userId is not null && await users.ResumeSessionAsync(userId.Value, context.HttpContext.RequestAborted))
        {
            return;
        }

        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(context.Scheme.Name);
    }

    /// <inheritdoc />
    public override Task RedirectToLogin(RedirectContext<CookieAuthenticationOptions> context)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    }

    /// <inheritdoc />
    public override Task RedirectToAccessDenied(RedirectContext<CookieAuthenticationOptions> context)
    {
        ArgumentNullException.ThrowIfNull(context);
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    }
}
