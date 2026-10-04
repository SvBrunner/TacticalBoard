using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using TacticalBoard.Api.Authentication;
using TacticalBoard.Api.Configuration;

namespace TacticalBoard.UnitTests.Api.Authentication;

public sealed class AuthenticationServiceCollectionExtensionsTests : IDisposable
{
    // Keys go to a temporary directory, never to the default location in the home directory.
    private readonly string _keysDirectory = Path.Combine(Path.GetTempPath(), "tb-keys-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_keysDirectory))
        {
            Directory.Delete(_keysDirectory, recursive: true);
        }
    }

    private ServiceProvider Build(Dictionary<string, string?>? extra = null)
    {
        var settings = new Dictionary<string, string?>
        {
            ["Oidc:Authority"] = "https://idp.example.org/realms/x/",
            ["Oidc:ClientId"] = "tacticalboard",
            ["Oidc:ClientSecret"] = "secret",
            ["DataProtection:KeysDirectory"] = _keysDirectory,
        };
        foreach (var (key, value) in extra ?? [])
        {
            settings[key] = value;
        }

        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddAppOptions();
        services.AddBffAuthentication(configuration);
        return services.BuildServiceProvider();
    }

    private static OpenIdConnectOptions Oidc(ServiceProvider services) =>
        services.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(OpenIdConnectDefaults.AuthenticationScheme);

    private static CookieAuthenticationOptions Cookie(ServiceProvider services) =>
        services.GetRequiredService<IOptionsMonitor<CookieAuthenticationOptions>>().Get(CookieAuthenticationDefaults.AuthenticationScheme);

    [Fact]
    public async Task Uses_the_session_cookie_by_default_and_oidc_for_the_login()
    {
        using var services = Build();
        var schemes = services.GetRequiredService<IAuthenticationSchemeProvider>();

        Assert.Equal(CookieAuthenticationDefaults.AuthenticationScheme, (await schemes.GetDefaultAuthenticateSchemeAsync())!.Name);
        Assert.Equal(CookieAuthenticationDefaults.AuthenticationScheme, (await schemes.GetDefaultChallengeSchemeAsync())!.Name);
        Assert.NotNull(await schemes.GetSchemeAsync(OpenIdConnectDefaults.AuthenticationScheme));
    }

    [Fact]
    public void Configures_the_session_cookie()
    {
        using var services = Build();
        var cookie = Cookie(services);

        Assert.Equal("__Host-tb_session", cookie.Cookie.Name);
        Assert.True(cookie.Cookie.HttpOnly);
        Assert.Equal(SameSiteMode.Lax, cookie.Cookie.SameSite);
        Assert.Equal(CookieSecurePolicy.Always, cookie.Cookie.SecurePolicy);
        Assert.Equal("/", cookie.Cookie.Path);
        Assert.True(cookie.SlidingExpiration);
        Assert.Equal(typeof(SessionCookieEvents), cookie.EventsType);
    }

    [Fact]
    public void Allows_insecure_cookies_for_local_development()
    {
        using var services = Build(new() { ["Session:SecureCookies"] = "false" });

        Assert.Equal("tb_session", Cookie(services).Cookie.Name);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, Cookie(services).Cookie.SecurePolicy);
        Assert.Equal(CookieSecurePolicy.SameAsRequest, Oidc(services).CorrelationCookie.SecurePolicy);
    }

    [Fact]
    public void Configures_the_code_flow_with_pkce()
    {
        using var services = Build();
        var oidc = Oidc(services);

        Assert.Equal("https://idp.example.org/realms/x", oidc.Authority);
        Assert.Equal("tacticalboard", oidc.ClientId);
        Assert.Equal("secret", oidc.ClientSecret);
        Assert.True(oidc.RequireHttpsMetadata);
        Assert.Equal(OpenIdConnectResponseType.Code, oidc.ResponseType);
        Assert.Equal(OpenIdConnectResponseMode.Query, oidc.ResponseMode);
        Assert.True(oidc.UsePkce);
        Assert.Equal(["openid", "profile", "email"], oidc.Scope);
        Assert.Equal(AuthPaths.Callback, oidc.CallbackPath.Value);
        Assert.Equal(AuthPaths.SignedOutCallback, oidc.SignedOutCallbackPath.Value);
        Assert.False(oidc.RemoteSignOutPath.HasValue);
        Assert.Equal(CookieAuthenticationDefaults.AuthenticationScheme, oidc.SignInScheme);
        Assert.True(oidc.SaveTokens);
        Assert.True(oidc.GetClaimsFromUserInfoEndpoint);
        Assert.False(oidc.MapInboundClaims);
        Assert.Equal(SameSiteMode.Lax, oidc.CorrelationCookie.SameSite);
        Assert.Equal(SameSiteMode.Lax, oidc.NonceCookie.SameSite);
        Assert.Equal(typeof(OidcEvents), oidc.EventsType);
    }

    [Fact]
    public void Keeps_the_issuer_claim_and_maps_preferred_username_from_userinfo()
    {
        using var services = Build();
        var actions = Oidc(services).ClaimActions.ToList();

        Assert.DoesNotContain(actions, action => action.ClaimType == "iss");
        Assert.Contains(actions, action => action.ClaimType == "preferred_username");
    }

    [Fact]
    public void Uses_a_separate_metadata_address_and_http_when_configured()
    {
        using var services = Build(new()
        {
            ["Oidc:MetadataAddress"] = "http://idp:8080/realms/x/.well-known/openid-configuration",
            ["Oidc:RequireHttpsMetadata"] = "false",
            ["Oidc:Scope"] = "openid profile",
        });
        var oidc = Oidc(services);

        Assert.Equal("http://idp:8080/realms/x/.well-known/openid-configuration", oidc.MetadataAddress);
        Assert.False(oidc.RequireHttpsMetadata);
        Assert.Equal(["openid", "profile"], oidc.Scope);
    }

    [Fact]
    public void Leaves_the_secret_out_for_a_public_client()
    {
        using var services = Build(new() { ["Oidc:ClientSecret"] = "" });

        Assert.Null(Oidc(services).ClientSecret);
    }

    [Fact]
    public void Configures_antiforgery_for_header_and_form()
    {
        using var services = Build();
        var antiforgery = services.GetRequiredService<IOptions<AntiforgeryOptions>>().Value;

        Assert.Equal("X-CSRF-TOKEN", antiforgery.HeaderName);
        Assert.Equal("__RequestVerificationToken", antiforgery.FormFieldName);
        Assert.Equal("__Host-tb_antiforgery", antiforgery.Cookie.Name);
        Assert.Equal(SameSiteMode.Strict, antiforgery.Cookie.SameSite);
        Assert.Equal(CookieSecurePolicy.Always, antiforgery.Cookie.SecurePolicy);
        Assert.True(antiforgery.Cookie.HttpOnly);
        Assert.NotNull(services.GetService<IAntiforgery>());
    }

    [Fact]
    public void Persists_data_protection_keys_to_the_configured_directory()
    {
        using var services = Build();

        var repository = services.GetRequiredService<IOptions<KeyManagementOptions>>().Value.XmlRepository;

        var fileSystem = Assert.IsType<FileSystemXmlRepository>(repository);
        Assert.Equal(_keysDirectory, fileSystem.Directory.FullName);
        Assert.Equal(DataProtectionSettings.ApplicationName, services.GetRequiredService<IOptions<DataProtectionOptions>>().Value.ApplicationDiscriminator);
    }

    [Fact]
    public void Validates_the_oidc_settings()
    {
        using var services = Build(new() { ["Oidc:ClientId"] = "" });

        Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IOptions<OidcSettings>>().Value);
    }

    [Fact]
    public void Registers_the_login_helpers()
    {
        using var services = Build();
        using var scope = services.CreateScope();

        Assert.IsType<DiscoveryEndSessionSupport>(services.GetRequiredService<IEndSessionSupport>());
        Assert.NotNull(services.GetRequiredService<PublicUrls>());
        Assert.NotNull(services.GetRequiredService<Microsoft.AspNetCore.Authorization.IAuthorizationService>());
    }
}
