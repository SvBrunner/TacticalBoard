using TacticalBoard.Situations.Endpoints;

namespace TacticalBoard.UnitTests.Situations;

public class RevisionTagTests
{
    [Fact]
    public void Formats_a_revision_as_a_strong_entity_tag() => Assert.Equal("\"7\"", RevisionTag.Format(7));

    [Theory]
    [InlineData("\"7\"", 7)]
    [InlineData(" \"12\" ", 12)]
    [InlineData("W/\"3\"", 3)]
    public void Reads_a_revision(string header, int expected)
    {
        Assert.True(RevisionTag.TryParse(header, out var revision));
        Assert.Equal(expected, revision);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("7")]
    [InlineData("\"\"")]
    [InlineData("\"0\"")]
    [InlineData("\"-1\"")]
    [InlineData("\"+1\"")]
    [InlineData("\"1\", \"2\"")]
    [InlineData("*")]
    [InlineData("\"abc\"")]
    [InlineData("\"99999999999\"")]
    public void Rejects_anything_else(string? header) => Assert.False(RevisionTag.TryParse(header, out _));
}
