namespace TacticalBoard.Folders.Contracts;

/// <summary>
/// What a folder contains. Implemented by the Situations module (which may use Folders, not the
/// other way round, ch. 5.2): Folders asks it before deleting a folder, because a folder can only
/// be deleted while it contains no (non-deleted) situations (ch. 8.16).
/// </summary>
public interface IFolderContents
{
    /// <summary>Whether a non-deleted situation is in the folder <paramref name="folderId"/>.</summary>
    Task<bool> HasSituationsAsync(Guid folderId, CancellationToken cancellationToken);
}
