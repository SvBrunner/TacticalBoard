using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// Applies pending migrations when the backend starts, before it accepts requests
/// (arc42 ch. 7), unless <see cref="DatabaseOptions.MigrateOnStartup"/> is off.
/// A failed migration stops the start.
/// </summary>
public sealed partial class DatabaseMigrationHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<DatabaseOptions> options,
    ILogger<DatabaseMigrationHostedService> logger) : IHostedService
{
    /// <inheritdoc />
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!options.Value.MigrateOnStartup)
        {
            LogSkipped(logger);
            return;
        }

        LogMigrating(logger);
        await using var scope = scopeFactory.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ISchemaMigrator>().MigrateAsync(cancellationToken);
        LogMigrated(logger);
    }

    /// <inheritdoc />
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    [LoggerMessage(Level = LogLevel.Information, Message = "Database migration on startup is disabled.")]
    private static partial void LogSkipped(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Applying pending database migrations.")]
    private static partial void LogMigrating(ILogger logger);

    [LoggerMessage(Level = LogLevel.Information, Message = "Database schema is up to date.")]
    private static partial void LogMigrated(ILogger logger);
}
