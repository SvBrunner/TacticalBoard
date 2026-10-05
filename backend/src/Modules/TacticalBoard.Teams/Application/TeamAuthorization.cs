using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// <see cref="ITeamAuthorization"/> on the current user's membership and the permission matrix
/// (<see cref="TeamPermissions"/>, arc42 ch. 8.1). System administrators get their team-management
/// rights here with roadmap Phase 2 step 9 — never access to the team's content.
/// </summary>
internal sealed class TeamAuthorization(ICurrentUser currentUser, ITeamMembershipRepository memberships) : ITeamAuthorization
{
    /// <inheritdoc />
    public async Task<TeamRole?> RoleOfCurrentUserAsync(Guid teamId, CancellationToken cancellationToken) =>
        currentUser.IsAuthenticated ? await memberships.FindRoleAsync(teamId, currentUser.Id, cancellationToken) : null;

    /// <inheritdoc />
    public Task<bool> CanChangeDetailsAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.ChangeDetails, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CanSeeMembersAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.SeeMembers, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CanManageMembersAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.ManageMembers, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CanDecideJoinRequestsAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.DecideJoinRequests, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CanDeleteTeamAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.DeleteTeam, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CanReadContentAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.ReadContent, cancellationToken);

    /// <inheritdoc />
    public Task<bool> CanWriteContentAsync(Guid teamId, CancellationToken cancellationToken) =>
        AllowsAsync(teamId, TeamPermission.WriteContent, cancellationToken);

    private async Task<bool> AllowsAsync(Guid teamId, TeamPermission permission, CancellationToken cancellationToken) =>
        TeamPermissions.Allows(await RoleOfCurrentUserAsync(teamId, cancellationToken), permission);
}
