namespace TacticalBoard.Teams.Contracts;

/// <summary>A member's role in a team (arc42 ch. 8.1, permission matrix). The creator of a team becomes <see cref="Admin"/>.</summary>
public enum TeamRole
{
    /// <summary>Manages the team: its name and logo, members and roles, join requests; deletes the team.</summary>
    Admin,

    /// <summary>Creates, edits and deletes the team's situations and folders.</summary>
    Editor,

    /// <summary>Views the team's situations and folders.</summary>
    Reader,
}
