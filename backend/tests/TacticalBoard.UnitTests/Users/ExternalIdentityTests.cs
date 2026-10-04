using TacticalBoard.Users.Domain;

namespace TacticalBoard.UnitTests.Users;

public class ExternalIdentityTests
{
    [Fact]
    public void Holds_issuer_and_subject()
    {
        var identity = new ExternalIdentity("https://idp.example.org", "abc");

        Assert.Equal("https://idp.example.org", identity.Issuer);
        Assert.Equal("abc", identity.Subject);
        Assert.Equal("https://idp.example.org|abc", identity.ToString());
    }

    [Fact]
    public void Compares_by_value_and_exactly()
    {
        Assert.Equal(new ExternalIdentity("https://i", "s"), new ExternalIdentity("https://i", "s"));
        Assert.NotEqual(new ExternalIdentity("https://i", "s"), new ExternalIdentity("https://i", "S"));
        Assert.NotEqual(new ExternalIdentity("https://i", "s"), new ExternalIdentity("https://i/", "s"));
    }

    [Theory]
    [InlineData("", "s")]
    [InlineData(" ", "s")]
    [InlineData("https://i", "")]
    [InlineData("https://i", " ")]
    public void Rejects_blank_parts(string issuer, string subject)
    {
        Assert.False(ExternalIdentity.IsValid(issuer, subject));
        Assert.ThrowsAny<ArgumentException>(() => new ExternalIdentity(issuer, subject));
    }

    [Fact]
    public void Rejects_overlong_parts()
    {
        var longSubject = new string('s', ExternalIdentity.MaxSubjectLength + 1);
        var longIssuer = "https://" + new string('i', ExternalIdentity.MaxIssuerLength);

        Assert.False(ExternalIdentity.IsValid("https://i", longSubject));
        Assert.False(ExternalIdentity.IsValid(longIssuer, "s"));
        Assert.True(ExternalIdentity.IsValid("https://i", new string('s', ExternalIdentity.MaxSubjectLength)));
        Assert.ThrowsAny<ArgumentException>(() => new ExternalIdentity("https://i", longSubject));
    }

    [Fact]
    public void Rejects_null_parts() => Assert.False(ExternalIdentity.IsValid(null, null));

    [Theory]
    [InlineData("https://idp.example.org/realms/x|8f6d-1", "https://idp.example.org/realms/x", "8f6d-1")]
    [InlineData("  https://i | s  ", "https://i", "s")]
    [InlineData("https://i|a|b", "https://i", "a|b")]
    public void Parses_the_configuration_format(string text, string issuer, string subject) =>
        Assert.Equal(new ExternalIdentity(issuer, subject), ExternalIdentity.Parse(text));

    [Theory]
    [InlineData("")]
    [InlineData("no-separator")]
    [InlineData("|subject")]
    [InlineData("https://i|")]
    [InlineData(" | ")]
    public void Rejects_malformed_configuration_entries(string text) =>
        Assert.Throws<FormatException>(() => ExternalIdentity.Parse(text));
}
