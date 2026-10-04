using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Domain;

namespace TacticalBoard.Folders.Application;

/// <summary>Stores <see cref="Folder"/>s.</summary>
internal interface IFolderRepository
{
    /// <summary>The non-deleted folder with <paramref name="id"/>, tracked for changes.</summary>
    Task<Folder?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// The non-deleted folder with <paramref name="id"/>, tracked, and locked exclusively until the
    /// running transaction ends: no situation can be moved into it or created in it meanwhile.
    /// </summary>
    Task<Folder?> LockForDeletionAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// The non-deleted folder with <paramref name="id"/> (read-only), locked against deletion
    /// (shared) until the running transaction ends; waits for a running deletion first.
    /// </summary>
    Task<Folder?> LockAgainstDeletionAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The non-deleted folders of <paramref name="area"/> (read-only).</summary>
    Task<IReadOnlyList<Folder>> ListAsync(AreaReference area, CancellationToken cancellationToken);

    /// <summary>Whether a non-deleted folder of <paramref name="area"/> other than <paramref name="exceptFolderId"/> has the normalized name.</summary>
    Task<bool> IsNameTakenAsync(AreaReference area, string normalizedName, Guid? exceptFolderId, CancellationToken cancellationToken);

    /// <summary>Adds and saves a new folder.</summary>
    /// <exception cref="FolderNameUniquenessViolationException">Another folder of the area got the same name in the meantime.</exception>
    Task AddAsync(Folder folder, CancellationToken cancellationToken);

    /// <summary>Saves the changes of tracked folders (a rename, a soft delete).</summary>
    /// <exception cref="FolderNameUniquenessViolationException">Another folder of the area got the same name in the meantime.</exception>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>The database's unique name index rejected a save (a parallel save took the name first).</summary>
internal sealed class FolderNameUniquenessViolationException : Exception
{
    public FolderNameUniquenessViolationException()
        : base("Another folder of the area has this name.")
    {
    }

    public FolderNameUniquenessViolationException(string message)
        : base(message)
    {
    }

    public FolderNameUniquenessViolationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
