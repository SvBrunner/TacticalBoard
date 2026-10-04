using TacticalBoard.Api.Authentication;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class ReturnUrlPolicyTests
{
    [Theory]
    [InlineData("/")]
    [InlineData("/editor")]
    [InlineData("/teams/ABC123?tab=members#top")]
    [InlineData("/a/b/c")]
    public void Keeps_local_paths(string url) => Assert.Equal(url, ReturnUrlPolicy.Sanitize(url));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("editor")]
    [InlineData("https://evil.example.org/")]
    [InlineData("http://localhost:8080/")]
    [InlineData("//evil.example.org")]
    [InlineData("/\\evil.example.org")]
    [InlineData("/path\\with-backslash")]
    [InlineData("/line\nbreak")]
    [InlineData("javascript:alert(1)")]
    public void Replaces_everything_else_with_the_start_page(string? url) =>
        Assert.Equal("/", ReturnUrlPolicy.Sanitize(url));

    [Fact]
    public void Rejects_overlong_paths() =>
        Assert.Equal("/", ReturnUrlPolicy.Sanitize("/" + new string('a', ReturnUrlPolicy.MaxLength)));
}
