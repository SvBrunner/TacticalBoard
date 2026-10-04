using TacticalBoard.Folders.Application;

namespace TacticalBoard.Folders.Endpoints;

/// <summary>A folder (arc42 ch. 8.15).</summary>
internal sealed record FolderResponse(Guid Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt)
{
    public static FolderResponse From(FolderView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new FolderResponse(view.Id, view.Name, view.CreatedAt, view.UpdatedAt);
    }
}
