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

    /// <summary>See the team's folders and situations (and open, export and play them back).</summary>
    ReadContent,

    /// <summary>Create, change and delete the team's situations, create, rename and delete its folders, move situations between them.</summary>
    WriteContent,
}

/// <summary>The team permission matrix of arc42 ch. 8.1, by role.</summary>
internal static class TeamPermissions
{
    /// <summary>Whether a member with <paramref name="role"/> (<c>null</c>: no member) may do <paramref name="permission"/>.</summary>
    public static bool Allows(TeamRole? role, TeamPermission permission) => (role, permission) switch
    {
        (null, _) => false,
        (_, TeamPermission.SeeMembers or TeamPermission.Leave or TeamPermission.ReadContent) => true,
        (TeamRole.Admin or TeamRole.Editor, TeamPermission.WriteContent) => true,
        (TeamRole.Admin, TeamPermission.ChangeDetails or TeamPermission.ManageMembers or TeamPermission.DecideJoinRequests or TeamPermission.DeleteTeam) => true,
        _ => false,
    };
}
