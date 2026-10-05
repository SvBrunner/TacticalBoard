using TacticalBoard.Teams.Domain;

namespace TacticalBoard.UnitTests.Teams;

public class TeamNameTests
{
    [Fact]
    public void Is_trimmed_and_normalized_for_comparison()
    {
        Assert.True(TeamName.TryCreate("  Lions Zürich ", out var name, out _));

        Assert.Equal("Lions Zürich", name.Value);
        Assert.Equal("LIONS ZÜRICH", name.Normalized);
        Assert.Equal("Lions Zürich", name.ToString());
    }

    [Fact]
    public void Composed_and_decomposed_accents_compare_equal()
    {
        TeamName.TryCreate("Zürich", out var decomposed, out _);
        TeamName.TryCreate("Zürich", out var composed, out _);

        Assert.Equal(composed!.Normalized, decomposed!.Normalized);
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData("", "required")]
    [InlineData("   ", "required")]
    [InlineData("a\tb", "control-characters")]
    [InlineData("a\nb", "control-characters")]
    public void Rejects_invalid_names(string? input, string code)
    {
        Assert.False(TeamName.TryCreate(input, out var name, out var error));

        Assert.Null(name);
        Assert.Equal(code, error.Code);
    }

    [Fact]
    public void Accepts_up_to_64_characters()
    {
        Assert.Equal(64, TeamName.MaxLength);
        Assert.True(TeamName.TryCreate(new string('a', 64), out _, out _));

        Assert.False(TeamName.TryCreate(new string('a', 65), out _, out var error));
        Assert.Equal(("too-long", 64), (error.Code, error.Values["maxLength"]));
        Assert.Equal("expected at most 64 characters", error.Message);
    }
}
