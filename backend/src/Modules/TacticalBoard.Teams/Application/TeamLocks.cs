using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// Runs a change of a team's members, join requests or existence in one transaction that first
/// locks the team row (arc42 ch. 8.17): such changes of one team run one after another, so the
/// "at least one Admin" rule and "one pending request" hold under parallel requests, and nothing
/// slips in while the team is deleted. The work checks the current user's rights itself, after the
/// lock, so it sees the roles as they are now.
/// </summary>
internal sealed class TeamLocks(ITeamRepository teams, IUnitOfWork transactions)
{
    /// <summary>Runs <paramref name="work"/> with the locked team named by <paramref name="key"/>.</summary>
    /// <exception cref="TeamNotFoundException">There is no such (non-deleted) team.</exception>
    public Task<T> RunAsync<T>(TeamKey key, Func<Team, CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        ArgumentNullException.ThrowIfNull(work);
        return transactions.InTransactionAsync(
            async cancellation =>
            {
                var team = await teams.LockAsync(key, cancellation) ?? throw new TeamNotFoundException(key.ToString());
                return await work(team, cancellation);
            },
            cancellationToken);
    }
}
