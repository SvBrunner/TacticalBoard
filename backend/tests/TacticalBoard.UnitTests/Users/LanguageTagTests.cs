using TacticalBoard.Users.Domain;

namespace TacticalBoard.UnitTests.Users;

public class LanguageTagTests
{
    [Theory]
    [InlineData("de", "de")]
    [InlineData("EN", "en")]
    [InlineData(" de-CH ", "de-ch")]
    [InlineData("gsw", "gsw")]
    [InlineData("zh-Hant-TW", "zh-hant-tw")]
    public void Accepts_language_tags_in_lower_case(string input, string expected)
    {
        Assert.True(LanguageTag.TryCreate(input, out var tag, out var error));
        Assert.Equal(expected, tag.Value);
        Assert.Equal(expected, tag.ToString());
        Assert.Null(error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void Rejects_a_blank_tag_as_required(string? input)
    {
        Assert.False(LanguageTag.TryCreate(input, out var tag, out var error));
        Assert.Null(tag);
        Assert.Equal("required", error?.Code);
    }

    [Theory]
    [InlineData("d")]
    [InlineData("deutsch")]
    [InlineData("de_CH")]
    [InlineData("de-")]
    [InlineData("de-toolongsubtag")]
    [InlineData("1e")]
    public void Rejects_what_is_not_a_language_tag(string input)
    {
        Assert.False(LanguageTag.TryCreate(input, out _, out var error));
        Assert.Equal("unsupported-language", error?.Code);
    }

    [Fact]
    public void Rejects_a_tag_longer_than_the_column()
    {
        var input = "de" + string.Concat(Enumerable.Repeat("-abcdefgh", 4)); // 38 characters

        Assert.False(LanguageTag.TryCreate(input, out _, out var error));
        Assert.Equal("unsupported-language", error?.Code);
    }

    [Fact]
    public void Restores_a_trusted_tag()
    {
        Assert.Equal("de", LanguageTag.FromTrusted("de").Value);
        Assert.Throws<ArgumentException>(() => LanguageTag.FromTrusted(" "));
    }
}
