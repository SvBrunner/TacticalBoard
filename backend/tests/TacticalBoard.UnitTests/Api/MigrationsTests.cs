using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Api.Hosting;
using TacticalBoard.Infrastructure.Persistence;

namespace TacticalBoard.UnitTests.Api;

/// <summary>Checks the migrations against the model, without a database.</summary>
public class MigrationsTests
{
    private static ServiceProvider BuildServices()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused" })
            .Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        new ApiHost(ModuleCatalog.All).ConfigureServices(services, configuration);
        return services.BuildServiceProvider();
    }

    [Fact]
    public void The_model_has_no_changes_missing_from_the_migrations()
    {
        using var services = BuildServices();
        using var scope = services.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>();

        Assert.False(
            context.Database.HasPendingModelChanges(),
            "The model changed: add a migration (dotnet ef migrations add <Name> --project src/TacticalBoard.Api --output-dir Persistence/Migrations).");
    }

    [Fact]
    public void The_initial_migration_exists()
    {
        using var services = BuildServices();
        using var scope = services.CreateScope();

        var migrations = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>().Database.GetMigrations().ToList();

        Assert.NotEmpty(migrations);
        Assert.EndsWith("_InitialCreate", migrations[0], StringComparison.Ordinal);
    }
}
