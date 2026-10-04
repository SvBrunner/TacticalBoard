using System.Text.RegularExpressions;

namespace TacticalBoard.SharedKernel.Errors;

/// <summary>Rules for error codes: kebab-case segments of lowercase letters and digits.</summary>
public static partial class ErrorCode
{
    /// <summary>Whether <paramref name="code"/> is a valid error code.</summary>
    public static bool IsValid(string? code) => code is not null && Pattern().IsMatch(code);

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*$", RegexOptions.CultureInvariant)]
    private static partial Regex Pattern();
}
