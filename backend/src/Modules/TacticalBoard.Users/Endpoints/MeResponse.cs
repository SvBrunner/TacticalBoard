using TacticalBoard.Users.Application;

namespace TacticalBoard.Users.Endpoints;

/// <summary>The body of <c>GET /api/me</c>: the logged-in user.</summary>
internal sealed record MeResponse(Guid Id, string DisplayName, bool IsSystemAdministrator)
{
    public static MeResponse From(SessionUser user)
    {
        ArgumentNullException.ThrowIfNull(user);
        return new MeResponse(user.Id, user.DisplayName, user.IsSystemAdministrator);
    }
}
