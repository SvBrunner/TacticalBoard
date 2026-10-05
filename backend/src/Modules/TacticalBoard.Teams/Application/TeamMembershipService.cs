using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// A team's members (arc42 ch. 1, 8.1, 8.17): the member list (every member, Readers included),
/// changing roles and removing members (Admins; their own role and membership included), and
/// leaving the team (every member) — always so that the team keeps at least one Admin
/// (<see cref="TeamRoster"/>). Every change runs with the team locked (<see cref="TeamLocks"/>), so
/// the rule holds under parallel requests. A member who left or was removed loses access with their
/// next request (roles are read fresh every time).
/// </summary>
internal sealed class TeamMembershipService(
    ITeamRepository teams,
    ITeamMembershipRepository memberships,
    ITeamAuthorization authorization,
    TeamMemberNames names,
    TeamLocks locks,
    ICurrentUser currentUser,
    IClock clock)
{
    /// <summary>The team's members with display name and role, by name.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is no member.</exception>
    public async Task<IReadOnlyList<TeamMemberView>> ListAsync(TeamKey key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        var team = await teams.FindAsync(key, cancellationToken) ?? throw new TeamNotFoundException(key.ToString());
        if (!await authorization.CanSeeMembersAsync(team.Id, cancellationToken))
        {
            throw new TeamAccessDeniedException("Only the team's members may see its member list.");
        }

        var members = await memberships.ListAsync(team.Id, cancellationToken);
        var displayNames = await names.OfAsync(members.Select(member => member.UserId), cancellationToken);
        return TeamMemberNames.Ordered(members.Select(member => View(member, displayNames.GetValueOrDefault(member.UserId))));
    }

    /// <summary>Gives the member <paramref name="userId"/> the role <paramref name="role"/>. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    /// <exception cref="TeamMemberNotFoundException">The user is no member.</exception>
    /// <exception cref="LastTeamAdminException">It would leave the team without an Admin.</exception>
    public Task<TeamMemberView> ChangeRoleAsync(TeamKey key, Guid userId, TeamRole role, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                await EnsureCanManageAsync(team, cancellation);
                var roster = await RosterAsync(team, cancellation);
                var member = roster.ChangeRole(userId, role);
                await memberships.SaveChangesAsync(cancellation);
                return View(member, await names.OfAsync(member.UserId, cancellation));
            },
            cancellationToken);

    /// <summary>Removes the member <paramref name="userId"/> from the team (an Admin may remove themselves). Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    /// <exception cref="TeamMemberNotFoundException">The user is no member.</exception>
    /// <exception cref="LastTeamAdminException">They are the team's last Admin.</exception>
    public Task RemoveAsync(TeamKey key, Guid userId, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                await EnsureCanManageAsync(team, cancellation);
                await TakeOutAsync(team, userId, cancellation);
                return true;
            },
            cancellationToken);

    /// <summary>The current user leaves the team.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team.</exception>
    /// <exception cref="TeamMemberNotFoundException">The current user is no member.</exception>
    /// <exception cref="LastTeamAdminException">They are its last Admin (they have to make someone else Admin, or delete the team).</exception>
    public Task LeaveAsync(TeamKey key, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                await TakeOutAsync(team, currentUser.Id, cancellation);
                return true;
            },
            cancellationToken);

    private async Task TakeOutAsync(Team team, Guid userId, CancellationToken cancellationToken)
    {
        var roster = await RosterAsync(team, cancellationToken);
        var member = roster.Remove(userId);
        member.MarkDeleted(clock.UtcNow);
        await memberships.SaveChangesAsync(cancellationToken);
    }

    private async Task EnsureCanManageAsync(Team team, CancellationToken cancellationToken)
    {
        if (!await authorization.CanManageMembersAsync(team.Id, cancellationToken))
        {
            throw new TeamAccessDeniedException("Only the team's Admins may change roles and remove members.");
        }
    }

    private async Task<TeamRoster> RosterAsync(Team team, CancellationToken cancellationToken) =>
        new(team.Id, await memberships.ListAsync(team.Id, cancellationToken));

    private static TeamMemberView View(TeamMembership member, string? displayName) =>
        new(member.UserId, displayName, member.Role, member.JoinedAt);
}
