using TacticalBoard.Teams.Application;

namespace TacticalBoard.UnitTests.Teams;

public class TeamSearchTests
{
    [Fact]
    public void Without_parameters_lists_all_teams_from_the_start()
    {
        Assert.True(TeamSearch.TryCreate(null, null, null, out var search, out _));

        Assert.Equal((null, 0, 50), (search.Text, search.Offset, search.Limit));
        Assert.Null(search.NameFragment);
        Assert.Null(search.CodeFragment);
        Assert.Equal(search, TeamSearch.All);
    }

    [Fact]
    public void A_blank_text_lists_all_teams()
    {
        Assert.True(TeamSearch.TryCreate("   ", 10, 20, out var search, out _));

        Assert.Equal((null, 10, 20), (search.Text, search.Offset, search.Limit));
    }

    [Fact]
    public void Matches_the_name_like_names_are_compared_and_the_code_in_upper_case()
    {
        Assert.True(TeamSearch.TryCreate("  zür ", null, null, out var search, out _));

        Assert.Equal("zür", search.Text);
        Assert.Equal("ZÜR", search.NameFragment);
        Assert.Equal("ZÜR", search.CodeFragment);
    }

    [Theory]
    [InlineData(-1, null, "offset")]
    [InlineData(null, 0, "limit")]
    [InlineData(null, 101, "limit")]
    public void Rejects_a_bad_page(int? offset, int? limit, string field)
    {
        Assert.False(TeamSearch.TryCreate(null, offset, limit, out var search, out var errors));

        Assert.Null(search);
        Assert.Equal("invalid-value", Assert.Single(errors.For(field)).Code);
    }

    [Fact]
    public void Rejects_a_text_longer_than_any_name_could_match()
    {
        Assert.True(TeamSearch.TryCreate(new string('a', 100), null, 100, out _, out _));

        Assert.False(TeamSearch.TryCreate(new string('a', 101), null, null, out _, out var errors));
        Assert.Equal("too-long", Assert.Single(errors.For(TeamSearch.TextField)).Code);
    }
}
