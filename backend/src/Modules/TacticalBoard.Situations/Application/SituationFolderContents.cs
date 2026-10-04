using TacticalBoard.Folders.Contracts;

namespace TacticalBoard.Situations.Application;

/// <summary><see cref="IFolderContents"/> for the Folders module: whether a folder still contains situations.</summary>
internal sealed class SituationFolderContents(ISituationRepository situations) : IFolderContents
{
    /// <inheritdoc />
    public Task<bool> HasSituationsAsync(Guid folderId, CancellationToken cancellationToken) =>
        situations.AnyInFolderAsync(folderId, cancellationToken);
}
