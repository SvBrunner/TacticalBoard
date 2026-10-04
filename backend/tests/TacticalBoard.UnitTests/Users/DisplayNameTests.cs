using TacticalBoard.Users.Domain;

namespace TacticalBoard.UnitTests.Users;

public class DisplayNameTests
{
    [Theory]
    [InlineData("Sven", "Sven")]
    [InlineData("  Sven Brunner  ", "Sven Brunner")]
    [InlineData("Jürg Müller-Ößwald", "Jürg Müller-Ößwald")]
    public void Accepts_and_trims_a_valid_name(string input, string expected)
    {
        Assert.True(DisplayName.TryCreate(input, out var name, out var error));
        Assert.Equal(expected, name.Value);
        Assert.Null(error);
    }

    [Fact]
    public void Accepts_exactly_the_maximum_length()
    {
        Assert.True(DisplayName.TryCreate(new string('a', DisplayName.MaxLength), out var name, out _));
        Assert.Equal(DisplayName.MaxLength, name.Value.Length);
    }

    [Fact]
    public void Counts_the_length_after_trimming() =>
        Assert.True(DisplayName.TryCreate("  " + new string('a', DisplayName.MaxLength) + "  ", out _, out _));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void Rejects_a_blank_name(string? input)
    {
        Assert.False(DisplayName.TryCreate(input, out var name, out var error));
        Assert.Null(name);
        Assert.Equal("The display name must not be empty.", error);
    }

    [Fact]
    public void Rejects_a_too_long_name()
    {
        Assert.False(DisplayName.TryCreate(new string('a', DisplayName.MaxLength + 1), out _, out var error));
        Assert.Equal("The display name must be at most 100 characters long.", error);
    }

    [Fact]
    public void Rejects_control_characters()
    {
        Assert.False(DisplayName.TryCreate("Sven\u0000Brunner", out _, out var error));
        Assert.Equal("The display name must not contain control characters.", error);
    }

    [Fact]
    public void Takes_the_name_claim_first() =>
        Assert.Equal("Test Trainer", DisplayName.FromIdentityProvider("Test Trainer", "trainer", "t@example.org").Value);

    [Fact]
    public void Falls_back_to_the_preferred_username() =>
        Assert.Equal("trainer", DisplayName.FromIdentityProvider(null, "trainer", "t@example.org").Value);

    [Fact]
    public void Falls_back_to_the_email() =>
        Assert.Equal("t@example.org", DisplayName.FromIdentityProvider(null, null, "t@example.org").Value);

    [Fact]
    public void Skips_blank_claims() =>
        Assert.Equal("t@example.org", DisplayName.FromIdentityProvider("  ", "", "t@example.org").Value);

    [Fact]
    public void Uses_a_fallback_without_any_claim() =>
        Assert.Equal(DisplayName.Fallback, DisplayName.FromIdentityProvider(null, " ", null).Value);

    [Fact]
    public void Trims_claims_and_replaces_control_characters() =>
        Assert.Equal("Test  Trainer", DisplayName.FromIdentityProvider("  Test\n Trainer ", null, null).Value);

    [Fact]
    public void Cuts_an_overlong_claim_to_the_maximum_length()
    {
        var name = DisplayName.FromIdentityProvider(new string('a', 150), null, null);

        Assert.Equal(new string('a', DisplayName.MaxLength), name.Value);
    }

    [Fact]
    public void Never_cuts_a_surrogate_pair_in_half()
    {
        // 99 letters, then an emoji (2 UTF-16 units) across the limit.
        var name = DisplayName.FromIdentityProvider(new string('a', 99) + "\U0001F3D1" + "b", null, null);

        Assert.Equal(new string('a', 99), name.Value);
        Assert.True(DisplayName.TryCreate(name.Value, out _, out _));
    }

    [Fact]
    public void Restores_a_trusted_value()
    {
        Assert.Equal("Alice", DisplayName.FromTrusted("Alice").Value);
        Assert.Equal("Alice", DisplayName.FromTrusted("Alice").ToString());
        Assert.ThrowsAny<ArgumentException>(() => DisplayName.FromTrusted(" "));
    }

    [Fact]
    public void Compares_by_value() =>
        Assert.Equal(DisplayName.FromTrusted("Alice"), DisplayName.FromIdentityProvider("Alice", null, null));
}
