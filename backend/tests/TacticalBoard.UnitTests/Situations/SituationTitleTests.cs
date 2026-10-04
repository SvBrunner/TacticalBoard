using TacticalBoard.Situations.Domain;

namespace TacticalBoard.UnitTests.Situations;

public class SituationTitleTests
{
    [Theory]
    [InlineData("Powerplay", "Powerplay")]
    [InlineData("  Powerplay 2-3-1  ", "Powerplay 2-3-1")]
    [InlineData("", SituationTitle.Default)]
    [InlineData("   ", SituationTitle.Default)]
    [InlineData(null, SituationTitle.Default)]
    public void Trims_and_defaults_a_blank_title(string? input, string expected)
    {
        Assert.True(SituationTitle.TryCreate(input, out var title, out var error));
        Assert.Equal(expected, title.Value);
        Assert.Null(error);
    }

    [Fact]
    public void Accepts_the_maximum_length_and_rejects_more()
    {
        Assert.True(SituationTitle.TryCreate(" " + new string('a', SituationTitle.MaxLength) + " ", out _, out _));
        Assert.False(SituationTitle.TryCreate(new string('a', SituationTitle.MaxLength + 1), out var title, out var error));
        Assert.Null(title);
        Assert.Equal("expected at most 200 characters", error);
    }

    [Theory]
    [InlineData("Powerplay", "powerplay ")]
    [InlineData("Übergang", "übergang")]
    [InlineData("Café", "Café")] // decomposed and composed é
    public void Compares_ignoring_case_whitespace_and_composition(string a, string b) =>
        Assert.Equal(SituationTitle.Normalize(a), SituationTitle.Normalize(b));

    [Theory]
    [InlineData("Untitled Situation", true)]
    [InlineData("untitled situation", true)]
    [InlineData("", true)]
    [InlineData("Untitled Situation (2)", false)]
    [InlineData("Powerplay", false)]
    public void Knows_the_default_title(string input, bool isDefault)
    {
        Assert.True(SituationTitle.TryCreate(input, out var title, out _));
        Assert.Equal(isDefault, title.IsDefault);
    }

    [Fact]
    public void Numbers_a_title()
    {
        Assert.Equal("Powerplay (2)", SituationTitle.FromTrusted("Powerplay").WithNumber(2).Value);
        Assert.Throws<ArgumentOutOfRangeException>(() => SituationTitle.FromTrusted("Powerplay").WithNumber(1));
    }

    [Fact]
    public void A_free_title_stays_as_it_is() =>
        Assert.Equal("Powerplay", SituationTitle.FromTrusted("Powerplay").FirstFree(new HashSet<string> { "BREAKOUT" }).Value);

    [Fact]
    public void A_taken_title_gets_the_next_free_number()
    {
        var taken = new HashSet<string> { "POWERPLAY", "POWERPLAY (2)", "POWERPLAY (4)" };

        Assert.Equal("Powerplay (3)", SituationTitle.FromTrusted("Powerplay").FirstFree(taken).Value);
    }

    [Fact]
    public void A_numbered_title_gets_its_own_suffix() =>
        Assert.Equal(
            "Powerplay (2) (2)",
            SituationTitle.FromTrusted("Powerplay (2)").FirstFree(new HashSet<string> { "POWERPLAY (2)" }).Value);

    [Fact]
    public void Restores_a_trusted_title_and_rejects_a_blank_one()
    {
        Assert.Equal("Powerplay", SituationTitle.FromTrusted("Powerplay").ToString());
        Assert.Throws<ArgumentException>(() => SituationTitle.FromTrusted(" "));
        Assert.Throws<ArgumentNullException>(() => SituationTitle.FromTrusted("x").FirstFree(null!));
        Assert.Throws<ArgumentNullException>(() => SituationTitle.Normalize(null!));
    }
}
