namespace TacticalBoard.Teams.Contracts;

/// <summary>
/// Finds teams for other modules (arc42 ch. 5.2): Areas turns the team named in a request
/// (<c>/api/teams/{team}/…</c>, its code or its id, ch. 8.17) into the team's area. Access is not
/// checked here; the caller asks <see cref="ITeamAuthorization"/>.
/// </summary>
public interface ITeamDirectory
{
    /// <summary>
    /// The id of the non-deleted team named by <paramref name="key"/> — its code (any case) or its
    /// id —, or <c>null</c> if there is none or the key is malformed.
    /// </summary>
    Task<Guid?> FindIdAsync(string? key, CancellationToken cancellationToken);
}
