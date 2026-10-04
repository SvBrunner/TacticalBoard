namespace TacticalBoard.SharedKernel.Persistence;

/// <summary>
/// Runs work in one database transaction, across modules (they share one database context per
/// request). Used where a rule spans two modules and must hold under parallel requests, e.g. "a
/// folder can only be deleted while it is empty" against a parallel move into it (arc42 ch. 8.15).
/// </summary>
public interface IUnitOfWork
{
    /// <summary>
    /// Runs <paramref name="work"/> in a transaction and commits it, or rolls it back if the work
    /// throws. Inside a running transaction, the work simply joins it.
    /// </summary>
    Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken);
}
