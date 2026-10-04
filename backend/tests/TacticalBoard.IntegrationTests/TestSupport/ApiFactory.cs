using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace TacticalBoard.IntegrationTests.TestSupport;

/// <summary>Starts the real backend (Program) in process, configured like the container (Production).</summary>
public sealed class ApiFactory(IReadOnlyDictionary<string, string?> settings) : WebApplicationFactory<Program>
{
    public static ApiFactory WithDatabase(string connectionString, bool migrateOnStartup = true) =>
        new(new Dictionary<string, string?>
        {
            ["ConnectionStrings:TacticalBoard"] = connectionString,
            ["Database:MigrateOnStartup"] = migrateOnStartup ? "true" : "false",
        });

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(Environments.Production);
        foreach (var (key, value) in settings)
        {
            builder.UseSetting(key, value);
        }
    }
}
