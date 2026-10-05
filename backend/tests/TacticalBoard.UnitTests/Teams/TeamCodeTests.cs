using TacticalBoard.Teams.Domain;

namespace TacticalBoard.UnitTests.Teams;

public class TeamCodeTests
{
    [Theory]
    [InlineData("ABC123", "ABC123")]
    [InlineData("abc123", "ABC123")]
    [InlineData(" Zz9900 ", "ZZ9900")]
    [InlineData("000000", "000000")]
    public void Reads_six_letters_or_digits_in_any_case(string text, string expected)
    {
        Assert.True(TeamCode.TryParse(text, out var code));

        Assert.Equal(expected, code.Value);
        Assert.Equal(expected, code.ToString());
        Assert.Equal(code, TeamCode.Parse(text));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("ABC12")]
    [InlineData("ABC1234")]
    [InlineData("ABC-12")]
    [InlineData("ÄBC123")]
    [InlineData("AB C12")]
    public void Rejects_anything_else(string? text)
    {
        Assert.False(TeamCode.TryParse(text, out var code));
        Assert.Null(code);
        Assert.Throws<ArgumentException>(() => TeamCode.Parse(text ?? string.Empty));
    }

    [Fact]
    public void Uses_upper_case_letters_and_digits()
    {
        Assert.Equal(6, TeamCode.Length);
        Assert.Equal("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", TeamCode.Alphabet);
    }
}
