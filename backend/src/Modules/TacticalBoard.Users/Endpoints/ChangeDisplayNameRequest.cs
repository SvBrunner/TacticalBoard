namespace TacticalBoard.Users.Endpoints;

/// <summary>The body of <c>PUT /api/me/display-name</c>.</summary>
internal sealed record ChangeDisplayNameRequest(string? DisplayName);

/// <summary>The body of <c>PUT /api/me/language</c>: a language tag such as <c>de</c> (arc42 ch. 8.18).</summary>
internal sealed record ChangeLanguageRequest(string? Language);
