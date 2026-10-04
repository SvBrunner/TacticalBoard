using TacticalBoard.Users.Application;

namespace TacticalBoard.Users.Endpoints;

/// <summary>The body of <c>GET /api/me</c>: the logged-in user.</summary>
/// <param name="Id">The user's id.</param>
/// <param name="DisplayName">The display name.</param>
/// <param name="IsSystemAdministrator">Whether the user is a system administrator.</param>
/// <param name="PreferredLanguage">The UI language the user chose (a language tag, arc42 ch. 8.18), or <c>null</c>.</param>
internal sealed record MeResponse(Guid Id, string DisplayName, bool IsSystemAdministrator, string? PreferredLanguage)
{
    public static MeResponse From(SessionUser user)
    {
        ArgumentNullException.ThrowIfNull(user);
        return new MeResponse(user.Id, user.DisplayName, user.IsSystemAdministrator, user.PreferredLanguage);
    }
}
