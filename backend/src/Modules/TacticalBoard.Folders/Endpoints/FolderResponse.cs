using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;

namespace TacticalBoard.Folders.Endpoints;

/// <summary>A folder (arc42 ch. 8.15): with its area and whether the current user may change it (<c>canWrite</c>).</summary>
internal sealed record FolderResponse(Guid Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, AreaResponse Area, bool CanWrite)
{
    public static FolderResponse From(FolderView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new FolderResponse(view.Id, view.Name, view.CreatedAt, view.UpdatedAt, AreaResponse.From(view.Area), view.CanWrite);
    }
}
