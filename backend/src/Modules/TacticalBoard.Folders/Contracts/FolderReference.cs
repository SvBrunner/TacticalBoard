using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Folders.Contracts;

/// <summary>A (non-deleted) folder and the area it belongs to, for other modules (Situations).</summary>
/// <param name="Id">The folder's id.</param>
/// <param name="Area">The area the folder lives in; it never changes.</param>
public sealed record FolderReference(Guid Id, AreaReference Area);
