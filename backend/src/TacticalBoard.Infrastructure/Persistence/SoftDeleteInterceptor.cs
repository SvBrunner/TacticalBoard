using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// Turns the physical deletion of an <see cref="ISoftDeletable"/> entity into a soft delete:
/// instead of a <c>DELETE</c>, the entity is updated with <c>DeletedAt</c> set to the current time.
/// This guarantees that nothing soft-deletable is ever deleted physically (arc42 ch. 8.16).
/// </summary>
public sealed class SoftDeleteInterceptor(IClock clock) : SaveChangesInterceptor
{
    /// <inheritdoc />
    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        ConvertDeletions(eventData.Context);
        return result;
    }

    /// <inheritdoc />
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ConvertDeletions(eventData.Context);
        return ValueTask.FromResult(result);
    }

    private void ConvertDeletions(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var deletions = context.ChangeTracker.Entries<ISoftDeletable>()
            .Where(entry => entry.State == EntityState.Deleted)
            .ToList();
        if (deletions.Count == 0)
        {
            return;
        }

        var now = clock.UtcNow;
        foreach (var entry in deletions)
        {
            entry.State = EntityState.Modified;
            entry.Entity.MarkDeleted(now);
        }
    }
}
