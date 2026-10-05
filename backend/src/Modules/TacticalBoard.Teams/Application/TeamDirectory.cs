using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Application;

/// <summary><see cref="ITeamDirectory"/> on the team repository; a key is read like every <c>{team}</c> route (<see cref="TeamKey"/>).</summary>
internal sealed class TeamDirectory(ITeamRepository teams) : ITeamDirectory
{
    /// <inheritdoc />
    public async Task<Guid?> FindIdAsync(string? key, CancellationToken cancellationToken)
    {
        if (!TeamKey.TryParse(key, out var parsed))
        {
            return null;
        }

        var team = await teams.FindAsync(parsed, cancellationToken);
        return team?.Id;
    }
}
