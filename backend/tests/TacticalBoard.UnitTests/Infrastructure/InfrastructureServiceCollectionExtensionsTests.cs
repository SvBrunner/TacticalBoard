using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Identifiers;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Infrastructure.Time;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class InfrastructureServiceCollectionExtensionsTests
{
    private const string ConnectionString = "Host=db.example;Database=tacticalboard;Username=u;Password=p";

    private static ServiceProvider BuildPersistence(Dictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
        return new ServiceCollection()
            .AddSingleton<IConfiguration>(configuration)
            .AddLogging()
            .AddSharedKernelServices()
            .AddPersistence(migrationsAssembly: "Migrations.Assembly")
            .BuildServiceProvider();
    }

    [Fact]
    public void Registers_the_clock_and_id_generator()
    {
        using var services = new ServiceCollection().AddSharedKernelServices().BuildServiceProvider();

        Assert.IsType<SystemClock>(services.GetRequiredService<IClock>());
        Assert.IsType<SequentialGuidGenerator>(services.GetRequiredService<IIdGenerator>());
        Assert.Same(TimeProvider.System, services.GetRequiredService<TimeProvider>());
    }

    [Fact]
    public void Keeps_an_already_registered_clock()
    {
        var clock = new FixedClock(DateTimeOffset.UnixEpoch);
        using var services = new ServiceCollection().AddSingleton<IClock>(clock).AddSharedKernelServices().BuildServiceProvider();

        Assert.Same(clock, services.GetRequiredService<IClock>());
    }

    [Fact]
    public void Binds_the_database_options()
    {
        using var services = BuildPersistence(new()
        {
            ["ConnectionStrings:TacticalBoard"] = ConnectionString,
            ["Database:MigrateOnStartup"] = "false",
        });

        var options = services.GetRequiredService<IOptions<DatabaseOptions>>().Value;

        Assert.Equal(ConnectionString, options.ConnectionString);
        Assert.False(options.MigrateOnStartup);
    }

    [Fact]
    public void Migrates_on_startup_by_default()
    {
        using var services = BuildPersistence(new() { ["ConnectionStrings:TacticalBoard"] = ConnectionString });

        Assert.True(services.GetRequiredService<IOptions<DatabaseOptions>>().Value.MigrateOnStartup);
    }

    [Fact]
    public void Requires_a_connection_string()
    {
        using var services = BuildPersistence([]);

        var thrown = Assert.Throws<OptionsValidationException>(() => services.GetRequiredService<IOptions<DatabaseOptions>>().Value);

        Assert.Contains("ConnectionStrings:TacticalBoard", thrown.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Configures_the_context_for_postgresql_with_the_migrations_assembly()
    {
        using var services = BuildPersistence(new() { ["ConnectionStrings:TacticalBoard"] = ConnectionString });
        using var scope = services.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>();

        Assert.Equal("Npgsql.EntityFrameworkCore.PostgreSQL", context.Database.ProviderName);
        Assert.Equal(ConnectionString, context.Database.GetConnectionString());
        var migrationsAssembly = context.GetService<IDbContextOptions>()
            .Extensions.OfType<RelationalOptionsExtension>().Single().MigrationsAssembly;
        Assert.Equal("Migrations.Assembly", migrationsAssembly);
    }

    [Fact]
    public void Registers_the_soft_delete_interceptor_on_the_context()
    {
        using var services = BuildPersistence(new() { ["ConnectionStrings:TacticalBoard"] = ConnectionString });
        using var scope = services.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>();
        var interceptors = context.GetService<IDbContextOptions>()
            .Extensions.OfType<CoreOptionsExtension>().Single().Interceptors;

        Assert.Contains(services.GetRequiredService<SoftDeleteInterceptor>(), interceptors!);
    }

    [Fact]
    public void Registers_the_migrator_and_the_startup_migration()
    {
        using var services = BuildPersistence(new() { ["ConnectionStrings:TacticalBoard"] = ConnectionString });
        using var scope = services.CreateScope();

        Assert.IsType<EfCoreSchemaMigrator>(scope.ServiceProvider.GetRequiredService<ISchemaMigrator>());
        Assert.Contains(services.GetServices<IHostedService>(), service => service is DatabaseMigrationHostedService);
    }

    [Fact]
    public void Rejects_a_blank_migrations_assembly() =>
        Assert.ThrowsAny<ArgumentException>(() => new ServiceCollection().AddPersistence(" "));

    [Fact]
    public void Registers_a_model_configuration_for_an_assembly()
    {
        var assembly = typeof(Note).Assembly;
        using var services = new ServiceCollection().AddModelConfigurationFrom(assembly).BuildServiceProvider();

        var configuration = Assert.IsType<AssemblyModelConfiguration>(Assert.Single(services.GetServices<IModelConfiguration>()));
        Assert.Same(assembly, configuration.Assembly);
    }
}
