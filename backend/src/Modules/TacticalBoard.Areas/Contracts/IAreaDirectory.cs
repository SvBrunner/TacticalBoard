namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// Turns the area a request names into an <see cref="AreaReference"/> (arc42 ch. 8.15): a team's
/// area by the team's code or id (<c>/api/teams/{team}/folders|situations</c>). Access is not
/// checked here; the caller asks <see cref="IAreaAccess"/>.
/// </summary>
public interface IAreaDirectory
{
    /// <summary>The area of the non-deleted team named by <paramref name="teamKey"/> (its code, any case, or its id).</summary>
    /// <exception cref="TeamAreaNotFoundException">There is no such team (any more), or the key is malformed.</exception>
    Task<AreaReference> TeamAreaAsync(string? teamKey, CancellationToken cancellationToken);
}
