using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// Hides soft-deleted rows (arc42 ch. 8.16): every root entity type implementing
/// <see cref="ISoftDeletable"/> gets a named global query filter <c>DeletedAt == null</c>.
/// Queries that need deleted rows opt out with <c>IgnoreQueryFilters([SoftDeleteQueryFilter.Name])</c>.
/// </summary>
public static class SoftDeleteQueryFilter
{
    /// <summary>The query filter's name.</summary>
    public const string Name = "SoftDelete";

    /// <summary>Adds the filter to every soft-deletable entity type already in <paramref name="modelBuilder"/>.</summary>
    public static void ApplyTo(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes().Where(IsSoftDeletableRoot).ToList())
        {
            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(Name, NotDeleted(entityType.ClrType));
        }
    }

    private static bool IsSoftDeletableRoot(IMutableEntityType entityType) =>
        entityType.BaseType is null
        && !entityType.IsOwned()
        && typeof(ISoftDeletable).IsAssignableFrom(entityType.ClrType);

    private static LambdaExpression NotDeleted(Type clrType)
    {
        var entity = Expression.Parameter(clrType, "entity");
        var deletedAt = Expression.Call(
            typeof(EF),
            nameof(EF.Property),
            [typeof(DateTimeOffset?)],
            entity,
            Expression.Constant(nameof(ISoftDeletable.DeletedAt)));
        var isNull = Expression.Equal(deletedAt, Expression.Constant(null, typeof(DateTimeOffset?)));
        return Expression.Lambda(isNull, entity);
    }
}
