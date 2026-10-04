using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace TacticalBoard.Api.Authentication;

/// <summary>
/// The login as backend for frontend (ADR-006, arc42 ch. 8.13): a cookie session, the OIDC
/// Authorization Code flow with PKCE against any standard provider, antiforgery, and the
/// data-protection keys that protect the cookies.
/// </summary>
public static class AuthenticationServiceCollectionExtensions
{
    /// <summary>The base name of the session cookie.</summary>
    public const string SessionCookieName = "tb_session";

    /// <summary>The base name of the antiforgery cookie.</summary>
    public const string AntiforgeryCookieName = "tb_antiforgery";

    /// <summary>Registers authentication, authorization, antiforgery and data protection.</summary>
    public static IServiceCollection AddBffAuthentication(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.AddOptions<OidcSettings>().BindConfiguration(OidcSettings.SectionName).ValidateOnStart();
        services.AddSingleton<IValidateOptions<OidcSettings>, OidcSettingsValidator>();
        services.AddOptions<SessionSettings>().BindConfiguration(SessionSettings.SectionName);

        AddDataProtection(services, configuration);

        services.AddSingleton<PublicUrls>();
        services.AddSingleton<IEndSessionSupport, DiscoveryEndSessionSupport>();
        services.AddScoped<SessionCookieEvents>();
        services.AddScoped<OidcEvents>();

        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie()
            .AddOpenIdConnect();
        services.AddOptions<CookieAuthenticationOptions>(CookieAuthenticationDefaults.AuthenticationScheme)
            .Configure<IOptions<SessionSettings>>((options, session) => ConfigureSessionCookie(options, session.Value));
        services.AddOptions<OpenIdConnectOptions>(OpenIdConnectDefaults.AuthenticationScheme)
            .Configure<IOptions<OidcSettings>, IOptions<SessionSettings>>(
                (options, oidc, session) => ConfigureOpenIdConnect(options, oidc.Value, session.Value));

        services.AddAuthorization();
        services.AddAntiforgery();
        services.AddOptions<Microsoft.AspNetCore.Antiforgery.AntiforgeryOptions>()
            .Configure<IOptions<SessionSettings>>((options, session) =>
            {
                options.HeaderName = AntiforgeryEndpoint.HeaderName;
                options.FormFieldName = AntiforgeryEndpoint.FormFieldName;
                options.Cookie.Name = session.Value.CookieName(AntiforgeryCookieName);
                options.Cookie.Path = "/";
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                options.Cookie.SecurePolicy = session.Value.SecurePolicy;
            });
        return services;
    }

    /// <summary>Adds authentication, authorization and the CSRF check to the pipeline, and maps the login endpoints.</summary>
    public static WebApplication UseBffAuthentication(this WebApplication app, IEndpointRouteBuilder api)
    {
        ArgumentNullException.ThrowIfNull(app);
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseMiddleware<AntiforgeryValidationMiddleware>();
        app.MapAuthEndpoints();
        api.MapAntiforgeryEndpoint();
        return app;
    }

    internal static void ConfigureSessionCookie(CookieAuthenticationOptions options, SessionSettings session)
    {
        options.Cookie.Name = session.CookieName(SessionCookieName);
        options.Cookie.Path = "/";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = session.SecurePolicy;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromDays(14);
        options.EventsType = typeof(SessionCookieEvents);
    }

    internal static void ConfigureOpenIdConnect(OpenIdConnectOptions options, OidcSettings oidc, SessionSettings session)
    {
        options.SignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.Authority = oidc.Authority?.AbsoluteUri.TrimEnd('/');
        if (oidc.MetadataAddress is not null)
        {
            options.MetadataAddress = oidc.MetadataAddress.AbsoluteUri;
        }

        options.RequireHttpsMetadata = oidc.RequireHttpsMetadata;
        options.ClientId = oidc.ClientId;
        options.ClientSecret = string.IsNullOrEmpty(oidc.ClientSecret) ? null : oidc.ClientSecret;

        options.ResponseType = OpenIdConnectResponseType.Code;
        // Query instead of form_post: the IdP's redirect back is then a top-level GET, which
        // carries the SameSite=Lax correlation and nonce cookies.
        options.ResponseMode = OpenIdConnectResponseMode.Query;
        options.UsePkce = true;
        options.Scope.Clear();
        foreach (var scope in oidc.Scopes)
        {
            options.Scope.Add(scope);
        }

        options.CallbackPath = AuthPaths.Callback;
        options.SignedOutCallbackPath = AuthPaths.SignedOutCallback;
        // IdP-initiated (front-channel) logout is not supported: an unauthenticated GET would end the session.
        options.RemoteSignOutPath = PathString.Empty;

        options.SaveTokens = true; // OidcEvents keeps only the ID token.
        options.GetClaimsFromUserInfoEndpoint = true;
        options.MapInboundClaims = false;
        options.ClaimActions.Remove("iss");
        options.ClaimActions.MapUniqueJsonKey("preferred_username", "preferred_username");
        options.TokenValidationParameters.NameClaimType = "name";
        options.DisableTelemetry = true;

        options.CorrelationCookie.SameSite = SameSiteMode.Lax;
        options.CorrelationCookie.SecurePolicy = session.SecurePolicy;
        options.NonceCookie.SameSite = SameSiteMode.Lax;
        options.NonceCookie.SecurePolicy = session.SecurePolicy;

        options.EventsType = typeof(OidcEvents);
    }

    private static void AddDataProtection(IServiceCollection services, IConfiguration configuration)
    {
        var settings = configuration.GetSection(DataProtectionSettings.SectionName).Get<DataProtectionSettings>()
            ?? new DataProtectionSettings();
        var dataProtection = services.AddDataProtection().SetApplicationName(DataProtectionSettings.ApplicationName);
        if (!string.IsNullOrWhiteSpace(settings.KeysDirectory))
        {
            dataProtection.PersistKeysToFileSystem(new DirectoryInfo(settings.KeysDirectory));
        }
    }
}
