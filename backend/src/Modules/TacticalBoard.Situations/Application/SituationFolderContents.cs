using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Contracts;

namespace TacticalBoard.Situations.Application;

/// <summary>
/// <see cref="IFolderContents"/> for the Folders module: whether a folder still contains
/// situations, and how many each folder of an area contains.
/// </summary>
internal sealed class SituationFolderContents(ISituationRepository situations) : IFolderContents
{
    /// <inheritdoc />
    public Task<bool> HasSituationsAsync(Guid folderId, CancellationToken cancellationToken) =>
        situations.AnyInFolderAsync(folderId, cancellationToken);

    /// <inheritdoc />
    public Task<IReadOnlyDictionary<Guid, int>> CountSituationsByFolderAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return situations.CountByFolderAsync(area, cancellationToken);
    }
}
