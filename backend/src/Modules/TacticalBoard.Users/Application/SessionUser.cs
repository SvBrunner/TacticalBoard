namespace TacticalBoard.Users.Application;

/// <summary>What a request needs to know about its user.</summary>
/// <param name="Id">The user's id.</param>
/// <param name="DisplayName">The display name.</param>
/// <param name="IsSystemAdministrator">Whether the user is a system administrator.</param>
/// <param name="IsBlocked">Whether the user is blocked.</param>
/// <param name="PreferredLanguage">The UI language the user chose (arc42 ch. 8.18), or <c>null</c>.</param>
internal sealed record SessionUser(Guid Id, string DisplayName, bool IsSystemAdministrator, bool IsBlocked, string? PreferredLanguage = null);
