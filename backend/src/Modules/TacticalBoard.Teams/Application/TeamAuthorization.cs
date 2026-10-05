using TacticalBoard.Teams.Contracts;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary><see cref="ITeamAuthorization"/> on the current user's membership (arc42 ch. 8.1).</summary>
internal sealed class TeamAuthorization(ICurrentUser currentUser, ITeamMembershipRepository memberships) : ITeamAuthorization
{
    /// <inheritdoc />
    public async Task<TeamRole?> RoleOfCurrentUserAsync(Guid teamId, CancellationToken cancellationToken) =>
        currentUser.IsAuthenticated ? await memberships.FindRoleAsync(teamId, currentUser.Id, cancellationToken) : null;

    /// <inheritdoc />
    public async Task<bool> CanChangeDetailsAsync(Guid teamId, CancellationToken cancellationToken) =>
        await RoleOfCurrentUserAsync(teamId, cancellationToken) == TeamRole.Admin;
}
