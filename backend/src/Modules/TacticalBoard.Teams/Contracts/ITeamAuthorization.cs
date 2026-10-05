namespace TacticalBoard.Teams.Contracts;

/// <summary>
/// The Teams module's authorization checks (arc42 ch. 5.2, 8.1): what the current user may do in a
/// team, by their role. Other modules (Areas, for team situations and folders) ask this instead of
/// checking roles themselves. Every answer is about a non-deleted team and is read fresh from the
/// database, so a member who was removed or left loses access with their next request.
/// </summary>
public interface ITeamAuthorization
{
    /// <summary>
    /// The current user's role in the (non-deleted) team <paramref name="teamId"/>, or <c>null</c>
    /// when they are no member (or not logged in, or the team doesn't exist).
    /// </summary>
    Task<TeamRole?> RoleOfCurrentUserAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether the current user may change the team's details — its name and logo: the team's
    /// Admins (product decision; system administrators too from roadmap Phase 2 step 9 on).
    /// </summary>
    Task<bool> CanChangeDetailsAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>Whether the current user may see the team's member list (and its code and link): every member.</summary>
    Task<bool> CanSeeMembersAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether the current user may manage the team's members — remove them, change roles (their
    /// own included): the team's Admins (system administrators from step 9 on).
    /// </summary>
    Task<bool> CanManageMembersAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>Whether the current user may see, accept and reject the team's join requests: its Admins (system administrators from step 9 on).</summary>
    Task<bool> CanDecideJoinRequestsAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>Whether the current user may delete the team: its Admins (system administrators from step 9 on).</summary>
    Task<bool> CanDeleteTeamAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether the current user may see the team's folders and situations: every member (Admin,
    /// Editor, Reader). Never system administrators as such — they have no access to content
    /// (arc42 ch. 8.1); only a membership counts.
    /// </summary>
    Task<bool> CanReadContentAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether the current user may create, change and delete the team's situations and folders
    /// (and move situations between its folders): its Admins and Editors, never Readers or system
    /// administrators as such (arc42 ch. 8.1).
    /// </summary>
    Task<bool> CanWriteContentAsync(Guid teamId, CancellationToken cancellationToken);
}
