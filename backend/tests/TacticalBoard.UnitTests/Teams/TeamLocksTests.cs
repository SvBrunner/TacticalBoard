using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamLocksTests
{
    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryTeamRepository _repository;

    public TeamLocksTests()
    {
        _repository = new InMemoryTeamRepository(_transactions);
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Runs_the_work_with_the_team_locked_in_a_transaction()
    {
        var team = _repository.AddTeam(Guid.NewGuid());
        var locks = new TeamLocks(_repository, _transactions);

        var result = await locks.RunAsync(TeamKey.OfId(team.Id), (locked, _) => Task.FromResult(locked), Cancellation);

        Assert.Same(team, result);
        Assert.Equal([(team.Id, true)], _repository.Locks);
        Assert.Equal(1, _transactions.Transactions);
    }

    [Fact]
    public async Task An_unknown_team_is_not_found_and_the_work_does_not_run()
    {
        var locks = new TeamLocks(_repository, _transactions);
        var ran = false;

        await Assert.ThrowsAsync<TeamNotFoundException>(() => locks.RunAsync(TeamKey.OfCode(TeamCode.Parse("ZZZZZZ")), (_, _) => Task.FromResult(ran = true), Cancellation));

        Assert.False(ran);
        Assert.Equal(1, _transactions.RolledBack);
    }

    [Fact]
    public async Task Needs_a_key_and_work()
    {
        var locks = new TeamLocks(_repository, _transactions);

        await Assert.ThrowsAsync<ArgumentNullException>(() => locks.RunAsync<bool>(null!, (_, _) => Task.FromResult(true), Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => locks.RunAsync<bool>(TeamKey.OfId(Guid.NewGuid()), null!, Cancellation));
    }
}
