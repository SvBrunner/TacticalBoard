using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using TacticalBoard.Infrastructure.Identifiers;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Infrastructure.Time;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.Infrastructure;

/// <summary>Registers the shared infrastructure in dependency injection.</summary>
public static class InfrastructureServiceCollectionExtensions
{
    /// <summary>Registers <see cref="IClock"/> and <see cref="IIdGenerator"/>.</summary>
    public static IServiceCollection AddSharedKernelServices(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<IClock, SystemClock>();
        services.TryAddSingleton<IIdGenerator, SequentialGuidGenerator>();
        return services;
    }

    /// <summary>
    /// Registers <see cref="TacticalBoardDbContext"/> on PostgreSQL (snake_case names, soft delete),
    /// the <see cref="DatabaseOptions"/> and the migration on startup.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="migrationsAssembly">The assembly that contains the EF Core migrations.</param>
    public static IServiceCollection AddPersistence(this IServiceCollection services, string migrationsAssembly)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(migrationsAssembly);

        services.AddOptions<DatabaseOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                configuration.GetSection(DatabaseOptions.SectionName).Bind(options);
                options.ConnectionString =
                    configuration.GetConnectionString(DatabaseOptions.ConnectionStringName) ?? string.Empty;
            })
            .Validate(
                options => !string.IsNullOrWhiteSpace(options.ConnectionString),
                $"The connection string 'ConnectionStrings:{DatabaseOptions.ConnectionStringName}' is missing.")
            .ValidateOnStart();

        services.AddSingleton<SoftDeleteInterceptor>();
        services.AddDbContext<TacticalBoardDbContext>((serviceProvider, options) =>
        {
            var database = serviceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            options
                .UseNpgsql(database.ConnectionString, npgsql => npgsql.MigrationsAssembly(migrationsAssembly))
                .UseSnakeCaseNamingConvention()
                .ReplaceService<IModelCacheKeyFactory, ModelConfigurationCacheKeyFactory>()
                .AddInterceptors(serviceProvider.GetRequiredService<SoftDeleteInterceptor>());
        });

        services.AddScoped<ISchemaMigrator, EfCoreSchemaMigrator>();
        services.AddHostedService<DatabaseMigrationHostedService>();
        return services;
    }

    /// <summary>Registers a module's EF Core entity configurations (all found in its assembly).</summary>
    public static IServiceCollection AddModelConfigurationFrom(this IServiceCollection services, System.Reflection.Assembly assembly)
    {
        services.AddSingleton<IModelConfiguration>(new AssemblyModelConfiguration(assembly));
        return services;
    }
}
