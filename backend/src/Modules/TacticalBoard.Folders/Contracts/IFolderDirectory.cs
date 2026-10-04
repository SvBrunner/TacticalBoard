namespace TacticalBoard.Folders.Contracts;

/// <summary>
/// Looks up folders for the Situations module (arc42 ch. 5.2: Situations uses Folders): which
/// area a folder belongs to, so a situation can be saved in it, moved into it or listed by it.
/// Access is not checked here; the caller asks Areas (<c>IAreaAccess</c>) for the folder's area.
/// </summary>
public interface IFolderDirectory
{
    /// <summary>The folder with <paramref name="folderId"/>, or <c>null</c> if it doesn't exist or is deleted.</summary>
    Task<FolderReference?> FindAsync(Guid folderId, CancellationToken cancellationToken);

    /// <summary>
    /// Like <see cref="FindAsync"/>, but keeps the folder from being deleted until the running
    /// transaction (<c>IUnitOfWork</c>) ends: for putting a situation into it. Waits for a running
    /// deletion of the folder, after which it is no longer found.
    /// </summary>
    Task<FolderReference?> FindForPlacingAsync(Guid folderId, CancellationToken cancellationToken);
}
