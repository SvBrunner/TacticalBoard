using Microsoft.EntityFrameworkCore;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>Applies the EF Core migrations of <see cref="TacticalBoardDbContext"/>.</summary>
public sealed class EfCoreSchemaMigrator(TacticalBoardDbContext context) : ISchemaMigrator
{
    /// <inheritdoc />
    public Task MigrateAsync(CancellationToken cancellationToken) => context.Database.MigrateAsync(cancellationToken);
}
