using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using TacticalBoard.Api.Configuration;

namespace TacticalBoard.UnitTests.Api;

public class AppOptionsTests
{
    private static readonly AppOptionsValidator Validator = new();

    private static ValidateOptionsResult Validate(string? url) =>
        Validator.Validate(null, new AppOptions { PublicBaseUrl = url is null ? null : new Uri(url, UriKind.RelativeOrAbsolute) });

    [Theory]
    [InlineData(null)]
    [InlineData("http://localhost:8080")]
    [InlineData("https://tacticalboard.example.org")]
    [InlineData("https://example.org/tacticalboard/")]
    public void Accepts_a_missing_or_absolute_http_url(string? url) => Assert.True(Validate(url).Succeeded);

    [Theory]
    [InlineData("/relative")]
    [InlineData("ftp://example.org")]
    [InlineData("https://example.org/?a=b")]
    [InlineData("https://example.org/#top")]
    public void Rejects_other_urls(string url)
    {
        var result = Validate(url);

        Assert.True(result.Failed);
        Assert.Contains("App:PublicBaseUrl", result.FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void Rejects_missing_options() => Assert.Throws<ArgumentNullException>(() => Validator.Validate(null, null!));

    [Fact]
    public void Binds_and_validates_the_app_section()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["App:PublicBaseUrl"] = "https://tb.example.org" })
            .Build();
        using var services = new ServiceCollection().AddSingleton<IConfiguration>(configuration).AddAppOptions().BuildServiceProvider();

        Assert.Equal(new Uri("https://tb.example.org"), services.GetRequiredService<IOptions<AppOptions>>().Value.PublicBaseUrl);
    }

    [Fact]
    public void Fails_on_an_invalid_configured_url()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["App:PublicBaseUrl"] = "not a url" })
            .Build();
        using var services = new ServiceCollection().AddSingleton<IConfiguration>(configuration).AddAppOptions().BuildServiceProvider();

        Assert.ThrowsAny<Exception>(() => services.GetRequiredService<IOptions<AppOptions>>().Value);
    }
}
