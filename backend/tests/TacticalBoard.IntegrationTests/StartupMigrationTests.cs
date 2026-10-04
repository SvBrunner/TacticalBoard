using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.IntegrationTests.TestSupport;

namespace TacticalBoard.IntegrationTests;

public class StartupMigrationTests(PostgresFixture postgres)
{
    [Fact]
    public async Task Creates_the_database_and_applies_all_migrations_on_startup()
    {
        var connectionString = postgres.NewDatabaseConnectionString();
        await using var factory = ApiFactory.WithDatabase(connectionString);

        _ = factory.Server; // starts the app
        using var scope = factory.Services.CreateScope();
        var database = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>().Database;

        var expected = database.GetMigrations().ToList();
        Assert.NotEmpty(expected);
        Assert.Equal(expected, await PostgresQueries.AppliedMigrationsAsync(connectionString, TestContext.Current.CancellationToken));
        Assert.Empty(await database.GetPendingMigrationsAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Starting_again_keeps_the_schema()
    {
        var connectionString = postgres.NewDatabaseConnectionString();
        await using (var first = ApiFactory.WithDatabase(connectionString))
        {
            _ = first.Server;
        }

        await using var second = ApiFactory.WithDatabase(connectionString);
        _ = second.Server;

        Assert.NotEmpty(await PostgresQueries.AppliedMigrationsAsync(connectionString, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Leaves_the_database_alone_when_migration_on_startup_is_off()
    {
        var connectionString = postgres.NewDatabaseConnectionString();
        await using var factory = ApiFactory.WithDatabase(connectionString, migrateOnStartup: false);

        _ = factory.Server;

        var database = new NpgsqlConnectionStringBuilder(connectionString).Database!;
        Assert.False(await PostgresQueries.DatabaseExistsAsync(postgres.AdminConnectionString, database, TestContext.Current.CancellationToken));
    }
}
