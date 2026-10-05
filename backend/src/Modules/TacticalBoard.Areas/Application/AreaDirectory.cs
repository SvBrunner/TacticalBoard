using TacticalBoard.Areas.Contracts;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary><see cref="IAreaDirectory"/>: a team's area through Teams' <see cref="ITeamDirectory"/>.</summary>
internal sealed class AreaDirectory(ITeamDirectory teams) : IAreaDirectory
{
    /// <inheritdoc />
    public async Task<AreaReference> TeamAreaAsync(string? teamKey, CancellationToken cancellationToken)
    {
        var teamId = await teams.FindIdAsync(teamKey, cancellationToken) ?? throw new TeamAreaNotFoundException(teamKey);
        return new AreaReference(AreaKind.Team, teamId);
    }
}
