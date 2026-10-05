using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamKeyTests
{
    [Theory]
    [InlineData("ABC123", "ABC123")]
    [InlineData(" abc123 ", "ABC123")]
    public void Reads_a_code_in_any_case(string text, string code)
    {
        Assert.True(TeamKey.TryParse(text, out var key));
        Assert.Equal((code, (Guid?)null), (key.Code!.Value, key.Id));
        Assert.Equal(code, key.ToString());
    }

    [Fact]
    public void Reads_an_id()
    {
        var id = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");

        Assert.True(TeamKey.TryParse(id.ToString().ToUpperInvariant(), out var key));
        Assert.Equal((id, (TeamCode?)null), (key.Id!.Value, key.Code));
        Assert.Equal(id.ToString(), key.ToString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ABC12")]
    [InlineData("ABC-123")]
    [InlineData("00000000-0000-0000-0000-000000000000")]
    public void Rejects_anything_else(string? text) => Assert.False(TeamKey.TryParse(text, out _));

    [Fact]
    public void Matches_its_team_by_code_or_id()
    {
        var team = TestTeams.Team(code: "ABC123");
        var other = TestTeams.Team(code: "XYZ789");

        Assert.True(TeamKey.OfCode(TeamCode.Parse("abc123")).Matches(team));
        Assert.False(TeamKey.OfCode(TeamCode.Parse("abc123")).Matches(other));
        Assert.True(TeamKey.OfId(team.Id).Matches(team));
        Assert.False(TeamKey.OfId(team.Id).Matches(other));
    }

    [Fact]
    public void Needs_an_id_or_a_code()
    {
        Assert.Throws<ArgumentException>(() => TeamKey.OfId(Guid.Empty));
        Assert.Throws<ArgumentNullException>(() => TeamKey.OfCode(null!));
        Assert.Throws<ArgumentNullException>(() => TeamKey.OfId(Guid.NewGuid()).Matches(null!));
    }

    [Fact]
    public void Is_compared_by_value() => Assert.Equal(TeamKey.OfCode(TeamCode.Parse("ABC123")), TeamKey.OfCode(TeamCode.Parse("abc123")));
}
