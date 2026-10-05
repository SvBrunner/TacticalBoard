using TacticalBoard.Areas.Application;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.SharedKernel.Errors;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Areas;

public class AreaDirectoryTests
{
    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Finds_a_teams_area_by_the_key_of_the_team()
    {
        var teamId = Guid.NewGuid();
        var directory = new AreaDirectory(new FakeTeamDirectory { Teams = { ["ABC123"] = teamId } });

        Assert.Equal(new AreaReference(AreaKind.Team, teamId), await directory.TeamAreaAsync("ABC123", Cancellation));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("ZZZ999")]
    public async Task An_unknown_team_is_team_not_found(string? key)
    {
        var directory = new AreaDirectory(new FakeTeamDirectory());

        var error = await Assert.ThrowsAsync<TeamAreaNotFoundException>(() => directory.TeamAreaAsync(key, Cancellation));

        Assert.Equal(("team-not-found", DomainErrorKind.NotFound), (error.Code, error.Kind));
    }

    [Fact]
    public void Area_responses_name_the_kind_and_the_owner()
    {
        var id = Guid.NewGuid();

        Assert.Equal(new AreaResponse("personal", id), AreaResponse.From(AreaReference.Personal(id)));
        Assert.Equal(new AreaResponse("team", id), AreaResponse.From(new AreaReference(AreaKind.Team, id)));
        Assert.Throws<ArgumentNullException>(() => AreaResponse.From(null!));
    }
}
