namespace TacticalBoard.Folders.Application;

/// <summary>A folder as an area's folder list shows it: with the number of (non-deleted) situations in it.</summary>
internal sealed record FolderSummary(FolderView Folder, int SituationCount);
