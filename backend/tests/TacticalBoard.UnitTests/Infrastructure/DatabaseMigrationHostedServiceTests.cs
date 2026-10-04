using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using TacticalBoard.Infrastructure.Persistence;

namespace TacticalBoard.UnitTests.Infrastructure;

public class DatabaseMigrationHostedServiceTests
{
    private sealed class SpyMigrator : ISchemaMigrator
    {
        public int Calls { get; private set; }

        public Exception? Failure { get; init; }

        public Task MigrateAsync(CancellationToken cancellationToken)
        {
            Calls++;
            return Failure is null ? Task.CompletedTask : Task.FromException(Failure);
        }
    }

    private static DatabaseMigrationHostedService CreateService(ISchemaMigrator migrator, bool migrateOnStartup)
    {
        var services = new ServiceCollection().AddScoped(_ => migrator).BuildServiceProvider();
        return new DatabaseMigrationHostedService(
            services.GetRequiredService<IServiceScopeFactory>(),
            Options.Create(new DatabaseOptions { ConnectionString = "Host=unused", MigrateOnStartup = migrateOnStartup }),
            NullLogger<DatabaseMigrationHostedService>.Instance);
    }

    [Fact]
    public async Task Migrates_on_start_when_enabled()
    {
        var migrator = new SpyMigrator();

        await CreateService(migrator, migrateOnStartup: true).StartAsync(TestContext.Current.CancellationToken);

        Assert.Equal(1, migrator.Calls);
    }

    [Fact]
    public async Task Does_not_migrate_when_disabled()
    {
        var migrator = new SpyMigrator();

        await CreateService(migrator, migrateOnStartup: false).StartAsync(TestContext.Current.CancellationToken);

        Assert.Equal(0, migrator.Calls);
    }

    [Fact]
    public async Task Fails_the_start_when_the_migration_fails()
    {
        var migrator = new SpyMigrator { Failure = new InvalidOperationException("broken") };

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateService(migrator, migrateOnStartup: true).StartAsync(TestContext.Current.CancellationToken));

        Assert.Equal("broken", thrown.Message);
    }

    [Fact]
    public async Task Does_nothing_on_stop()
    {
        var migrator = new SpyMigrator();

        await CreateService(migrator, migrateOnStartup: true).StopAsync(TestContext.Current.CancellationToken);

        Assert.Equal(0, migrator.Calls);
    }
}
