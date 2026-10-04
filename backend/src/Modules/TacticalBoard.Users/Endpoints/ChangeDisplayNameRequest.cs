namespace TacticalBoard.Users.Endpoints;

/// <summary>The body of <c>PUT /api/me/display-name</c>.</summary>
internal sealed record ChangeDisplayNameRequest(string? DisplayName);
