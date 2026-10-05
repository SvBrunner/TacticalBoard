using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;

namespace TacticalBoard.Folders.Endpoints;

/// <summary>A folder in the list of an area's folders (arc42 ch. 8.15): the folder and the number of (non-deleted) situations in it.</summary>
internal sealed record FolderSummaryResponse(
    Guid Id,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    AreaResponse Area,
    bool CanWrite,
    int SituationCount)
{
    public static FolderSummaryResponse From(FolderSummary summary)
    {
        ArgumentNullException.ThrowIfNull(summary);
        var folder = summary.Folder;
        return new FolderSummaryResponse(
            folder.Id,
            folder.Name,
            folder.CreatedAt,
            folder.UpdatedAt,
            AreaResponse.From(folder.Area),
            folder.CanWrite,
            summary.SituationCount);
    }
}
