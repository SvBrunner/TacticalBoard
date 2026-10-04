namespace TacticalBoard.Folders.Endpoints;

/// <summary>The body of <c>POST /api/personal-area/folders</c> and <c>PUT /api/folders/{id}</c>: the folder's name.</summary>
internal sealed record FolderNameRequest(string? Name);
