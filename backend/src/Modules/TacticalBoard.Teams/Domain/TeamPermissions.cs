using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Domain;

/// <summary>What a member may do in their team, beyond seeing its public data (arc42 ch. 8.1).</summary>
internal enum TeamPermission
{
    /// <summary>Rename the team, set/replace/remove its logo (not in the matrix; Admin-only, product decision).</summary>
    ChangeDetails,

    /// <summary>See the member list and the team's code and link.</summary>
    SeeMembers,

    /// <summary>Remove members and change roles (own role included), as long as an Admin remains.</summary>
    ManageMembers,

    /// <summary>See, accept and reject join requests.</summary>
    DecideJoinRequests,

    /// <summary>Leave the team (the last Admin can't, <see cref="TeamRoster"/>).</summary>
    Leave,

    /// <summary>Delete the team.</summary>
    DeleteTeam,
}

/// <summary>The team permission matrix of arc42 ch. 8.1, by role (team content follows with roadmap Phase 2 step 8).</summary>
internal static class TeamPermissions
{
    /// <summary>Whether a member with <paramref name="role"/> (<c>null</c>: no member) may do <paramref name="permission"/>.</summary>
    public static bool Allows(TeamRole? role, TeamPermission permission) => (role, permission) switch
    {
        (null, _) => false,
        (_, TeamPermission.SeeMembers or TeamPermission.Leave) => true,
        (TeamRole.Admin, TeamPermission.ChangeDetails or TeamPermission.ManageMembers or TeamPermission.DecideJoinRequests or TeamPermission.DeleteTeam) => true,
        _ => false,
    };
}
