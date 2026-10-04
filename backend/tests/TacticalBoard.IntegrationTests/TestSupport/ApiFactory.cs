using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>
/// Starts the real backend (Program) in process, configured like the container (Production),
/// with the login pointed at a <see cref="FakeIdentityProvider"/>.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly Dictionary<string, string?> _settings;
    private readonly FakeIdentityProvider _identityProvider;

    private readonly bool _ownsKeysDirectory;

    private ApiFactory(Dictionary<string, string?> settings, FakeIdentityProvider identityProvider)
    {
        _settings = settings;
        _identityProvider = identityProvider;
        _ownsKeysDirectory = !settings.TryGetValue("DataProtection:KeysDirectory", out var keysDirectory) || keysDirectory is null;
        KeysDirectory = keysDirectory ?? NewKeysDirectory();
    }

    /// <summary>
    /// The directory the data-protection keys of this instance are written to. A fresh temporary
    /// one (deleted on dispose) unless the settings name one, so tests never write to the home directory.
    /// </summary>
    public string KeysDirectory { get; }

    public static string NewKeysDirectory() => Path.Combine(Path.GetTempPath(), "tacticalboard-tests-keys-" + Guid.NewGuid().ToString("N"));

    internal FakeIdentityProvider IdentityProvider => _identityProvider;

    /// <summary>The settings every test instance gets besides the database (the login).</summary>
    public static Dictionary<string, string?> LoginSettings() => new()
    {
        ["App:PublicBaseUrl"] = "http://localhost",
        ["Oidc:Authority"] = FakeIdentityProvider.Issuer,
        ["Oidc:ClientId"] = FakeIdentityProvider.ClientId,
        ["Oidc:ClientSecret"] = FakeIdentityProvider.ClientSecret,
        ["Session:SecureCookies"] = "false",
    };

    public static ApiFactory WithDatabase(
        string connectionString,
        bool migrateOnStartup = true,
        IReadOnlyDictionary<string, string?>? settings = null)
    {
        var all = LoginSettings();
        all["ConnectionStrings:TacticalBoard"] = connectionString;
        all["Database:MigrateOnStartup"] = migrateOnStartup ? "true" : "false";
        foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
        {
            all[key] = value;
        }

        return new ApiFactory(all, new FakeIdentityProvider());
    }

    /// <summary>A client that behaves like a browser for the login: keeps cookies, does not follow redirects.</summary>
    internal TestBrowser CreateBrowser(Uri? baseAddress = null) =>
        new(
            CreateClient(new WebApplicationFactoryClientOptions
            {
                AllowAutoRedirect = false,
                HandleCookies = true,
                BaseAddress = baseAddress ?? new Uri("http://localhost"),
            }),
            _identityProvider);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Environments.Production);
        foreach (var (key, value) in _settings)
        {
            builder.UseSetting(key, value);
        }

        builder.UseSetting("DataProtection:KeysDirectory", KeysDirectory);

        builder.ConfigureTestServices(services =>
            services.Configure<OpenIdConnectOptions>(
                OpenIdConnectDefaults.AuthenticationScheme,
                options => options.BackchannelHttpHandler = _identityProvider));
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        _identityProvider.Dispose();
        if (_ownsKeysDirectory && Directory.Exists(KeysDirectory))
        {
            Directory.Delete(KeysDirectory, recursive: true);
        }
    }
}
