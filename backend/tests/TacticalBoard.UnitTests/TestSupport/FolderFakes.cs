using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="IUnitOfWork"/> that runs the work directly and records how often, and whether it failed.</summary>
internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int Transactions { get; private set; }

    public int RolledBack { get; private set; }

    /// <summary>Whether work is running inside a "transaction" right now.</summary>
    public bool InTransaction { get; private set; }

    public async Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<T>> work, CancellationToken cancellationToken)
    {
        Transactions++;
        InTransaction = true;
        try
        {
            return await work(cancellationToken);
        }
        catch
        {
            RolledBack++;
            throw;
        }
        finally
        {
            InTransaction = false;
        }
    }
}

/// <summary>An <see cref="IFolderDirectory"/> on a list of folders; records the lookups made to place a situation.</summary>
internal sealed class FakeFolderDirectory(FakeUnitOfWork? transactions = null) : IFolderDirectory
{
    public List<FolderReference> Folders { get; } = [];

    /// <summary>The folders looked up by <see cref="FindForPlacingAsync"/>, with whether a transaction was running.</summary>
    public List<(Guid FolderId, bool InTransaction)> Placements { get; } = [];

    public FolderReference Add(AreaReference area, Guid? id = null)
    {
        var folder = new FolderReference(id ?? Guid.NewGuid(), area);
        Folders.Add(folder);
        return folder;
    }

    public Task<FolderReference?> FindAsync(Guid folderId, CancellationToken cancellationToken) =>
        Task.FromResult(Folders.SingleOrDefault(folder => folder.Id == folderId));

    /// <summary>When set, the folder is gone (deleted in parallel) when it is locked for placing a situation.</summary>
    public bool DeletedBeforePlacing { get; set; }

    public Task<FolderReference?> FindForPlacingAsync(Guid folderId, CancellationToken cancellationToken)
    {
        Placements.Add((folderId, transactions?.InTransaction ?? false));
        return DeletedBeforePlacing ? Task.FromResult<FolderReference?>(null) : FindAsync(folderId, cancellationToken);
    }
}

/// <summary>An <see cref="IFolderContents"/> with a set of non-empty folders and the situation counts per area and folder.</summary>
internal sealed class FakeFolderContents : IFolderContents
{
    public HashSet<Guid> NonEmpty { get; } = [];

    /// <summary>The counts <see cref="CountSituationsByFolderAsync"/> returns, per area.</summary>
    public Dictionary<AreaReference, Dictionary<Guid, int>> Counts { get; } = [];

    /// <summary>The areas whose situations were counted, in order.</summary>
    public List<AreaReference> CountedAreas { get; } = [];

    public Task<bool> HasSituationsAsync(Guid folderId, CancellationToken cancellationToken) => Task.FromResult(NonEmpty.Contains(folderId));

    public Task<IReadOnlyDictionary<Guid, int>> CountSituationsByFolderAsync(AreaReference area, CancellationToken cancellationToken)
    {
        CountedAreas.Add(area);
        IReadOnlyDictionary<Guid, int> counts = Counts.TryGetValue(area, out var found) ? found : [];
        return Task.FromResult(counts);
    }
}

/// <summary>
/// An <see cref="IFolderRepository"/> on a list. Enforces the unique name like the database, can
/// simulate a parallel save taking a name, and records the locks taken.
/// </summary>
internal sealed class InMemoryFolderRepository(FakeUnitOfWork? transactions = null) : IFolderRepository
{
    public List<Folder> Folders { get; } = [];

    public int SaveCount { get; private set; }

    /// <summary>The locks taken (folder id, kind, whether a transaction was running).</summary>
    public List<(Guid Id, string Kind, bool InTransaction)> Locks { get; } = [];

    /// <summary>When set, the next add or save fails as if a parallel save took the name.</summary>
    public bool NameTakenInParallel { get; set; }

    /// <summary>When set, the folder disappears (a parallel deletion) right before it is locked for deletion.</summary>
    public bool DeletedInParallel { get; set; }

    public Task<Folder?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Folders.SingleOrDefault(folder => folder.Id == id && !folder.IsDeleted));

    public Task<Folder?> LockForDeletionAsync(Guid id, CancellationToken cancellationToken)
    {
        Locks.Add((id, "deletion", transactions?.InTransaction ?? false));
        if (DeletedInParallel)
        {
            Folders.Single(folder => folder.Id == id).MarkDeleted(DateTimeOffset.UnixEpoch);
        }

        return FindAsync(id, cancellationToken);
    }

    public Task<Folder?> LockAgainstDeletionAsync(Guid id, CancellationToken cancellationToken)
    {
        Locks.Add((id, "placing", transactions?.InTransaction ?? false));
        return FindAsync(id, cancellationToken);
    }

    public Task<IReadOnlyList<Folder>> ListAsync(AreaReference area, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Folder>>(Folders.Where(folder => folder.Area == area && !folder.IsDeleted).ToList());

    public Task<bool> IsNameTakenAsync(AreaReference area, string normalizedName, Guid? exceptFolderId, CancellationToken cancellationToken) =>
        Task.FromResult(Folders.Any(folder => folder.Area == area && !folder.IsDeleted && folder.Id != exceptFolderId && folder.NormalizedName == normalizedName));

    public Task AddAsync(Folder folder, CancellationToken cancellationToken)
    {
        ThrowIfNameTaken(folder);
        Folders.Add(folder);
        SaveCount++;
        return Task.CompletedTask;
    }

    public Task DeleteAllInAreaAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken)
    {
        foreach (var folder in Folders.Where(folder => folder.Area == area && !folder.IsDeleted))
        {
            folder.MarkDeleted(deletedAt);
        }

        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        foreach (var folder in Folders.Where(folder => !folder.IsDeleted))
        {
            ThrowIfNameTaken(folder);
        }

        SaveCount++;
        return Task.CompletedTask;
    }

    private void ThrowIfNameTaken(Folder folder)
    {
        if (NameTakenInParallel)
        {
            NameTakenInParallel = false;
            throw new FolderNameUniquenessViolationException();
        }

        if (Folders.Any(other => other.Id != folder.Id && other.Area == folder.Area && !other.IsDeleted && other.NormalizedName == folder.NormalizedName))
        {
            throw new FolderNameUniquenessViolationException();
        }
    }
}
