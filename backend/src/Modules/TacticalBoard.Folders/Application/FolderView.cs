using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Folders.Application;

/// <summary>
/// A folder as the API shows it: with its area and whether the current user may change content
/// there (<paramref name="CanWrite"/>: rename, delete, put situations into it — false for a team
/// Reader, arc42 ch. 8.1), so the UI only offers what is allowed.
/// </summary>
internal sealed record FolderView(Guid Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, AreaReference Area, bool CanWrite);
