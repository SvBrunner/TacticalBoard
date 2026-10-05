using TacticalBoard.Areas.Contracts;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary>
/// A team's area (arc42 ch. 8.1, roadmap Phase 2 step 8): every member (Admin, Editor, Reader) may
/// read it, its Admins and Editors may write it. Decided by Teams' role matrix
/// (<see cref="ITeamAuthorization"/>), read fresh per request, so a removed or demoted member loses
/// access with their next request. System administrators have no access as such.
/// </summary>
internal sealed class TeamAreaAccessRule(ITeamAuthorization teams) : IAreaAccessRule
{
    /// <inheritdoc />
    public AreaKind Kind => AreaKind.Team;

    /// <inheritdoc />
    public Task<bool> CanReadAsync(AreaReference area, CancellationToken cancellationToken) =>
        IsTeamArea(area) ? teams.CanReadContentAsync(area.OwnerId, cancellationToken) : Task.FromResult(false);

    /// <inheritdoc />
    public Task<bool> CanWriteAsync(AreaReference area, CancellationToken cancellationToken) =>
        IsTeamArea(area) ? teams.CanWriteContentAsync(area.OwnerId, cancellationToken) : Task.FromResult(false);

    private static bool IsTeamArea(AreaReference area)
    {
        ArgumentNullException.ThrowIfNull(area);
        return area.Kind == AreaKind.Team;
    }
}
