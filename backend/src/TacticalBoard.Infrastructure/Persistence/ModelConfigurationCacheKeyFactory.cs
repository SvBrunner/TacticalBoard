using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// EF Core caches a context's model per context type. The model of
/// <see cref="TacticalBoardDbContext"/> depends on the <see cref="IModelConfiguration"/>s it was
/// given (the modules), so they are part of the cache key: two hosts with different module sets
/// in one process (e.g. in tests) never share a model.
/// </summary>
public sealed class ModelConfigurationCacheKeyFactory : IModelCacheKeyFactory
{
    /// <inheritdoc />
    public object Create(DbContext context, bool designTime)
    {
        ArgumentNullException.ThrowIfNull(context);
        var configurations = context is TacticalBoardDbContext tacticalBoard ? tacticalBoard.ModelCacheKey : string.Empty;
        return (context.GetType(), configurations, designTime);
    }
}
