namespace TacticalBoard.Teams.Contracts;

/// <summary>
/// The Teams module's authorization checks (arc42 ch. 5.2, 8.1): what the current user may do in a
/// team, by their role. Other modules (Areas, for team situations and folders) ask this instead of
/// checking roles themselves.
/// </summary>
public interface ITeamAuthorization
{
    /// <summary>
    /// The current user's role in the (non-deleted) team <paramref name="teamId"/>, or <c>null</c>
    /// when they are no member (or not logged in, or the team doesn't exist).
    /// </summary>
    Task<TeamRole?> RoleOfCurrentUserAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>
    /// Whether the current user may change the team's details — its name and logo: only the team's
    /// Admins (arc42 ch. 8.17; renaming is not in the permission matrix of ch. 8.1, an open question).
    /// </summary>
    Task<bool> CanChangeDetailsAsync(Guid teamId, CancellationToken cancellationToken);
}
