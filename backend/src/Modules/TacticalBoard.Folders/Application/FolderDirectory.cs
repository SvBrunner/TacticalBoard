using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;

namespace TacticalBoard.Folders.Application;

/// <summary><see cref="IFolderDirectory"/> on the folder repository.</summary>
internal sealed class FolderDirectory(IFolderRepository folders) : IFolderDirectory
{
    /// <inheritdoc />
    public async Task<FolderReference?> FindAsync(Guid folderId, CancellationToken cancellationToken)
    {
        var folder = await folders.FindAsync(folderId, cancellationToken);
        return Reference(folder);
    }

    /// <inheritdoc />
    public async Task<FolderReference?> FindForPlacingAsync(Guid folderId, CancellationToken cancellationToken)
    {
        var folder = await folders.LockAgainstDeletionAsync(folderId, cancellationToken);
        return Reference(folder);
    }

    private static FolderReference? Reference(Folder? folder) => folder is null ? null : new FolderReference(folder.Id, folder.Area);
}
