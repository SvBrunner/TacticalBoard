namespace TacticalBoard.Users.Application;

/// <summary>What a request needs to know about its user.</summary>
internal sealed record SessionUser(Guid Id, string DisplayName, bool IsSystemAdministrator, bool IsBlocked);
