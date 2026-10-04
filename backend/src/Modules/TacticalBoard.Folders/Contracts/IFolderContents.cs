using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Folders.Contracts;

/// <summary>
/// What a folder contains. Implemented by the Situations module (which may use Folders, not the
/// other way round, ch. 5.2): Folders asks it before deleting a folder, because a folder can only
/// be deleted while it contains no (non-deleted) situations (ch. 8.16), and when listing an area's
/// folders with the number of situations in each (ch. 8.15).
/// </summary>
public interface IFolderContents
{
    /// <summary>Whether a non-deleted situation is in the folder <paramref name="folderId"/>.</summary>
    Task<bool> HasSituationsAsync(Guid folderId, CancellationToken cancellationToken);

    /// <summary>
    /// The number of non-deleted situations in each folder of <paramref name="area"/>, keyed by
    /// folder id, in one query. A folder without situations is missing from the result (count 0);
    /// situations at the top level are not counted.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, int>> CountSituationsByFolderAsync(AreaReference area, CancellationToken cancellationToken);
}
