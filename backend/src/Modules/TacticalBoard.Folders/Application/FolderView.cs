namespace TacticalBoard.Folders.Application;

/// <summary>A folder as the API shows it.</summary>
internal sealed record FolderView(Guid Id, string Name, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
