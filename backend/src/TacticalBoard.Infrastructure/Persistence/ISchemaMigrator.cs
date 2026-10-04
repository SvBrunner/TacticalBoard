namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>Brings the database schema up to date.</summary>
public interface ISchemaMigrator
{
    /// <summary>Applies all pending migrations.</summary>
    Task MigrateAsync(CancellationToken cancellationToken);
}
