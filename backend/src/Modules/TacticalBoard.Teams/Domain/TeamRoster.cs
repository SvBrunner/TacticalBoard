using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// The members of one team, for changing them (arc42 ch. 1, 8.1): change a member's role, remove a
/// member, let a member leave — always so that the team keeps <b>at least one Admin</b>. Built from
/// the team's current (non-deleted) memberships, which the caller loads while the team is locked,
/// so parallel changes can't each take away "the other" Admin (ch. 8.17).
/// </summary>
internal sealed class TeamRoster
{
    private readonly List<TeamMembership> _members;

    public TeamRoster(Guid teamId, IEnumerable<TeamMembership> members)
    {
        ArgumentNullException.ThrowIfNull(members);
        _members = members.Where(member => !member.IsDeleted).ToList();
        if (_members.Any(member => member.TeamId != teamId))
        {
            throw new ArgumentException("Every membership must belong to the team.", nameof(members));
        }

        TeamId = teamId;
    }

    public Guid TeamId { get; }

    /// <summary>The current members.</summary>
    public IReadOnlyList<TeamMembership> Members => _members;

    /// <summary>The membership of <paramref name="userId"/>, or <c>null</c> if they are no member.</summary>
    public TeamMembership? Find(Guid userId) => _members.SingleOrDefault(member => member.UserId == userId);

    /// <summary>Gives <paramref name="userId"/> the role <paramref name="role"/> (also an Admin, also oneself).</summary>
    /// <exception cref="TeamMemberNotFoundException">They are no member.</exception>
    /// <exception cref="LastTeamAdminException">It would leave the team without an Admin.</exception>
    public TeamMembership ChangeRole(Guid userId, TeamRole role)
    {
        var member = Get(userId);
        if (member.Role == role)
        {
            return member;
        }

        EnsureAnotherAdminRemains(member);
        member.ChangeRole(role);
        return member;
    }

    /// <summary>Takes <paramref name="userId"/> out of the team (removed by an Admin, or leaving); returns the membership to delete.</summary>
    /// <exception cref="TeamMemberNotFoundException">They are no member.</exception>
    /// <exception cref="LastTeamAdminException">They are the team's last Admin.</exception>
    public TeamMembership Remove(Guid userId)
    {
        var member = Get(userId);
        EnsureAnotherAdminRemains(member);
        _members.Remove(member);
        return member;
    }

    private TeamMembership Get(Guid userId) => Find(userId) ?? throw new TeamMemberNotFoundException(userId);

    private void EnsureAnotherAdminRemains(TeamMembership member)
    {
        if (member.Role == TeamRole.Admin && !_members.Any(other => other != member && other.Role == TeamRole.Admin))
        {
            throw new LastTeamAdminException();
        }
    }
}
