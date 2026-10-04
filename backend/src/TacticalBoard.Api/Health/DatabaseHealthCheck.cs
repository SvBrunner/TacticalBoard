using Microsoft.Extensions.Diagnostics.HealthChecks;
using TacticalBoard.Infrastructure.Persistence;

namespace TacticalBoard.Api.Health;

/// <summary>Healthy when the database can be reached.</summary>
public sealed class DatabaseHealthCheck(TacticalBoardDbContext dbContext) : IHealthCheck
{
    /// <inheritdoc />
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            return await dbContext.Database.CanConnectAsync(cancellationToken)
                ? HealthCheckResult.Healthy()
                : HealthCheckResult.Unhealthy("The database cannot be reached.");
        }
#pragma warning disable CA1031 // A health check reports every failure instead of throwing.
        catch (Exception exception)
#pragma warning restore CA1031
        {
            return HealthCheckResult.Unhealthy("The database cannot be reached.", exception);
        }
    }
}
