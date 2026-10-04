using TacticalBoard.SharedKernel.Text;

namespace TacticalBoard.UnitTests.SharedKernel;

public class UniqueNamesTests
{
    [Theory]
    [InlineData("Powerplay", "powerplay ")]
    [InlineData("  Übergang", "übergang")]
    [InlineData("Café", "Café")] // composed and decomposed é
    public void Equal_names_have_the_same_normal_form(string a, string b) =>
        Assert.Equal(UniqueNames.Normalize(a), UniqueNames.Normalize(b));

    [Theory]
    [InlineData("Powerplay", "Powerplay 2")]
    [InlineData("A B", "AB")]
    public void Different_names_stay_different(string a, string b) =>
        Assert.NotEqual(UniqueNames.Normalize(a), UniqueNames.Normalize(b));

    [Fact]
    public void Is_trimmed_and_upper_case() => Assert.Equal("BREAK OUT", UniqueNames.Normalize("  break out \t"));

    [Fact]
    public void Rejects_null() => Assert.Throws<ArgumentNullException>(() => UniqueNames.Normalize(null!));
}
