namespace TacticalBoard.Api.Authentication;

/// <summary>
/// Only local paths are allowed as the target after login (no open redirect, arc42 ch. 8.13):
/// they start with a single <c>/</c>, contain no backslash and no control characters.
/// Anything else becomes <see cref="AuthPaths.Home"/>.
/// </summary>
public static class ReturnUrlPolicy
{
    /// <summary>The longest accepted return URL.</summary>
    public const int MaxLength = 2048;

    /// <summary><paramref name="returnUrl"/> if it is a local path, otherwise <see cref="AuthPaths.Home"/>.</summary>
    public static string Sanitize(string? returnUrl) => IsLocalPath(returnUrl) ? returnUrl! : AuthPaths.Home;

    /// <summary>Whether <paramref name="returnUrl"/> is a path on this origin.</summary>
    public static bool IsLocalPath(string? returnUrl)
    {
        if (string.IsNullOrEmpty(returnUrl) || returnUrl.Length > MaxLength || returnUrl[0] != '/')
        {
            return false;
        }

        // "//host" and "/\host" are protocol-relative URLs to another host.
        if (returnUrl.Length > 1 && (returnUrl[1] == '/' || returnUrl[1] == '\\'))
        {
            return false;
        }

        return !returnUrl.Contains('\\', StringComparison.Ordinal) && !returnUrl.Any(char.IsControl);
    }
}
