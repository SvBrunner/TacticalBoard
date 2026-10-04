using System.Globalization;
using System.Security.Claims;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// The session's principal: only the local user id. Everything else (display name, roles,
/// blocked) is read from the database on every request, so changes apply immediately.
/// </summary>
public static class SessionClaims
{
    /// <summary>The claim with the local user id.</summary>
    public const string UserIdClaimType = "tb_uid";

    /// <summary>The authentication type of the session identity.</summary>
    public const string AuthenticationType = "TacticalBoardSession";

    /// <summary>A session principal for <paramref name="userId"/>.</summary>
    public static ClaimsPrincipal CreatePrincipal(Guid userId) =>
        new(new ClaimsIdentity(
            [new Claim(UserIdClaimType, userId.ToString("D", CultureInfo.InvariantCulture))],
            AuthenticationType,
            UserIdClaimType,
            roleType: null));

    /// <summary>The local user id of a session principal, or <c>null</c> if it has none.</summary>
    public static Guid? UserId(ClaimsPrincipal? principal)
    {
        var value = principal?.FindFirst(UserIdClaimType)?.Value;
        return Guid.TryParseExact(value, "D", out var id) ? id : null;
    }
}
