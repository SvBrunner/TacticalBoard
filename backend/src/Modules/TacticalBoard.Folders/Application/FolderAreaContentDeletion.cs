using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Folders.Application;

/// <summary>
/// The Folders part of an area going away (Areas' <see cref="IAreaContentDeletion"/>, arc42 ch. 5.2,
/// 8.16, ADR-015): soft-deletes all the area's folders — a deleted team's — in the deleting
/// transaction. Not the "only when empty" rule of a single folder: the situations go with the area too.
/// </summary>
internal sealed class FolderAreaContentDeletion(IFolderRepository folders) : IAreaContentDeletion
{
    /// <inheritdoc />
    public Task DeleteContentAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return folders.DeleteAllInAreaAsync(area, deletedAt, cancellationToken);
    }
}
