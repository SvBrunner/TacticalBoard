using TacticalBoard.Teams.Application;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamDirectoryTests
{
    private readonly InMemoryTeamRepository _repository = new();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamDirectory Directory => new(_repository);

    [Fact]
    public async Task Finds_a_team_by_its_code_in_any_case_or_by_its_id()
    {
        var team = TestTeams.Team(code: "ABC123");
        _repository.Teams.Add(team);

        Assert.Equal(team.Id, await Directory.FindIdAsync("ABC123", Cancellation));
        Assert.Equal(team.Id, await Directory.FindIdAsync("abc123", Cancellation));
        Assert.Equal(team.Id, await Directory.FindIdAsync(team.Id.ToString(), Cancellation));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("nope")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    [InlineData("ZZZ999")]
    public async Task Finds_nothing_for_a_malformed_or_unknown_key(string? key)
    {
        _repository.Teams.Add(TestTeams.Team(code: "ABC123"));

        Assert.Null(await Directory.FindIdAsync(key, Cancellation));
    }

    [Fact]
    public async Task Finds_no_deleted_team()
    {
        var team = TestTeams.Team(code: "ABC123");
        _repository.Teams.Add(team);
        team.MarkDeleted(TestTeams.Now);

        Assert.Null(await Directory.FindIdAsync("ABC123", Cancellation));
    }
}
