using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// <see cref="IUnitOfWork"/> on <see cref="TacticalBoardDbContext"/>: a database transaction on the
/// request's context. A failing <c>SaveChanges</c> inside it rolls back only to its automatic
/// savepoint, so the work may catch the error and try again (e.g. the next free title).
/// </summary>
public sealed class EfUnitOfWork(TacticalBoardDbContext context) : IUnitOfWork
{
    /// <inheritdoc />
    public async Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(work);
        if (context.Database.CurrentTransaction is not null)
        {
            return await work(cancellationToken);
        }

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var result = await work(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }
}
