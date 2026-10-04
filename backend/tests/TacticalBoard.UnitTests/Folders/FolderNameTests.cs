using TacticalBoard.Folders.Domain;

namespace TacticalBoard.UnitTests.Folders;

public class FolderNameTests
{
    [Theory]
    [InlineData("Powerplay", "Powerplay")]
    [InlineData("  Set pieces  ", "Set pieces")]
    public void Trims_the_name(string input, string expected)
    {
        Assert.True(FolderName.TryCreate(input, out var name, out var error));
        Assert.Equal(expected, name.Value);
        Assert.Equal(expected, name.ToString());
        Assert.Null(error);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Rejects_a_blank_name(string? input)
    {
        Assert.False(FolderName.TryCreate(input, out var name, out var error));
        Assert.Null(name);
        Assert.Equal("must not be empty", error?.Message);
        Assert.Equal("required", error?.Code);
    }

    [Fact]
    public void Accepts_the_maximum_length_and_rejects_more()
    {
        Assert.True(FolderName.TryCreate(" " + new string('a', FolderName.MaxLength) + " ", out _, out _));
        Assert.False(FolderName.TryCreate(new string('a', FolderName.MaxLength + 1), out _, out var error));
        Assert.Equal("expected at most 100 characters", error?.Message);
        Assert.Equal("too-long", error?.Code);
        Assert.Equal(100, error?.Values["maxLength"]);
    }

    [Theory]
    [InlineData("Line\nbreak")]
    [InlineData("Tab\tinside")]
    [InlineData("Bell\u0007")]
    public void Rejects_control_characters(string input)
    {
        Assert.False(FolderName.TryCreate(input, out _, out var error));
        Assert.Equal("must not contain control characters", error?.Message);
        Assert.Equal("control-characters", error?.Code);
    }

    [Fact]
    public void Compares_like_situation_titles()
    {
        Assert.True(FolderName.TryCreate(" Übergang ", out var a, out _));
        Assert.True(FolderName.TryCreate("übergang", out var b, out _));

        Assert.Equal(a.Normalized, b.Normalized);
        Assert.Equal("ÜBERGANG", a.Normalized);
    }
}
