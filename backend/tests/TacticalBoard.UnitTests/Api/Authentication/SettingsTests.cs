using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using TacticalBoard.Api.Authentication;
using TacticalBoard.Api.Configuration;

namespace TacticalBoard.UnitTests.Api.Authentication;

public class SettingsTests
{
    private static readonly OidcSettingsValidator Validator = new();

    private static OidcSettings Valid() => new() { Authority = new Uri("https://idp.example.org/realms/x"), ClientId = "tacticalboard" };

    [Fact]
    public void Accepts_a_complete_oidc_configuration() => Assert.True(Validator.Validate(null, Valid()).Succeeded);

    [Fact]
    public void Has_safe_oidc_defaults()
    {
        var settings = new OidcSettings();

        Assert.True(settings.RequireHttpsMetadata);
        Assert.Equal(["openid", "profile", "email"], settings.Scopes);
    }

    [Fact]
    public void Requires_an_authority()
    {
        var settings = Valid();
        settings.Authority = null;

        var result = Validator.Validate(null, settings);

        Assert.True(result.Failed);
        Assert.Contains("Oidc:Authority", result.FailureMessage, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("ftp://idp.example.org")]
    [InlineData("/relative")]
    public void Requires_an_http_authority(string authority)
    {
        var settings = Valid();
        settings.Authority = new Uri(authority, UriKind.RelativeOrAbsolute);

        Assert.True(Validator.Validate(null, settings).Failed);
    }

    [Fact]
    public void Checks_the_metadata_address()
    {
        var settings = Valid();
        settings.MetadataAddress = new Uri("/relative", UriKind.Relative);

        Assert.Contains("Oidc:MetadataAddress", Validator.Validate(null, settings).FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void Requires_a_client_id()
    {
        var settings = Valid();
        settings.ClientId = " ";

        Assert.Contains("Oidc:ClientId", Validator.Validate(null, settings).FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void Requires_the_openid_scope()
    {
        var settings = Valid();
        settings.Scope = "profile email";

        Assert.Contains("openid", Validator.Validate(null, settings).FailureMessage, StringComparison.Ordinal);
    }

    [Fact]
    public void Splits_scopes_on_spaces()
    {
        var settings = Valid();
        settings.Scope = " openid   profile ";

        Assert.Equal(["openid", "profile"], settings.Scopes);
    }

    [Fact]
    public void Secure_cookies_are_the_default()
    {
        var session = new SessionSettings();

        Assert.True(session.SecureCookies);
        Assert.Equal(CookieSecurePolicy.Always, session.SecurePolicy);
        Assert.Equal("__Host-tb_session", session.CookieName("tb_session"));
    }

    [Fact]
    public void Insecure_cookies_drop_the_host_prefix()
    {
        var session = new SessionSettings { SecureCookies = false };

        Assert.Equal(CookieSecurePolicy.SameAsRequest, session.SecurePolicy);
        Assert.Equal("tb_session", session.CookieName("tb_session"));
    }

    [Fact]
    public void Public_urls_use_the_configured_base_url()
    {
        var urls = new PublicUrls(Options.Create(new AppOptions { PublicBaseUrl = new Uri("https://tb.example.org/") }));

        Assert.Equal("https://tb.example.org/auth/callback", urls.For(AuthPaths.Callback));
    }

    [Fact]
    public void Public_urls_are_left_to_the_request_without_a_base_url()
    {
        var urls = new PublicUrls(Options.Create(new AppOptions()));

        Assert.Null(urls.For(AuthPaths.Callback));
    }
}
