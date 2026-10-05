using TacticalBoard.Teams.Domain;
using TacticalBoard.Teams.Infrastructure;

namespace TacticalBoard.UnitTests.Teams;

public class RandomTeamCodeGeneratorTests
{
    private readonly RandomTeamCodeGenerator _generator = new();

    [Fact]
    public void Generates_six_upper_case_letters_or_digits()
    {
        for (var i = 0; i < 200; i++)
        {
            Assert.Matches("^[A-Z0-9]{6}$", _generator.NewCode().Value);
        }
    }

    [Fact]
    public void Uses_the_whole_alphabet_and_rarely_repeats()
    {
        var codes = Enumerable.Range(0, 2000).Select(_ => _generator.NewCode().Value).ToList();

        Assert.Equal(TeamCode.Alphabet.Order(), codes.SelectMany(code => code).Distinct().Order());
        Assert.True(codes.Distinct().Count() >= 1990, "2000 random codes out of 36^6 should hardly ever repeat.");
    }
}
