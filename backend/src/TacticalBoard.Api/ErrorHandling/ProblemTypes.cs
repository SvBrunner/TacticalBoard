using System.Globalization;
using Microsoft.AspNetCore.WebUtilities;
using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Api.ErrorHandling;

/// <summary>
/// The Problem Details <c>type</c> URIs (arc42 ch. 8.2): <c>https://tacticalboard/errors/{code}</c>.
/// Domain errors use their own code; generic HTTP errors use a code derived from the status.
/// </summary>
public static class ProblemTypes
{
    /// <summary>The common prefix of all problem type URIs.</summary>
    public const string BaseUri = "https://tacticalboard/errors/";

    /// <summary>Code for requests whose input failed validation (with an <c>errors</c> member).</summary>
    public const string ValidationFailedCode = "validation-failed";

    /// <summary>Code for unexpected server errors.</summary>
    public const string InternalErrorCode = "internal-error";

    /// <summary>The type URI for an error code, e.g. <c>duplicate-title</c>.</summary>
    public static string ForCode(string code)
    {
        if (!ErrorCode.IsValid(code))
        {
            throw new ArgumentException($"Error code '{code}' must be kebab-case (a-z, 0-9, '-').", nameof(code));
        }

        return BaseUri + code;
    }

    /// <summary>The type URI for a generic error with HTTP status <paramref name="statusCode"/>.</summary>
    public static string ForStatusCode(int statusCode) => ForCode(CodeForStatusCode(statusCode));

    /// <summary>Whether <paramref name="type"/> is one of this app's problem type URIs.</summary>
    public static bool IsOwn(string? type) => type is not null && type.StartsWith(BaseUri, StringComparison.Ordinal);

    /// <summary>
    /// The error code of a generic HTTP error: <c>internal-error</c> for 500, otherwise the
    /// kebab-cased reason phrase (404 → <c>not-found</c>), or <c>http-{status}</c> if there is none.
    /// </summary>
    public static string CodeForStatusCode(int statusCode)
    {
        if (statusCode == StatusCodes.Status500InternalServerError)
        {
            return InternalErrorCode;
        }

        var reasonPhrase = ReasonPhrases.GetReasonPhrase(statusCode);
        if (string.IsNullOrEmpty(reasonPhrase))
        {
            return "http-" + statusCode.ToString(CultureInfo.InvariantCulture);
        }

        var words = reasonPhrase
            .Split([' ', '-'], StringSplitOptions.RemoveEmptyEntries)
            .Select(word => new string(word.Where(char.IsAsciiLetterOrDigit).ToArray()))
            .Where(word => word.Length > 0);
#pragma warning disable CA1308 // Error codes are lowercase by definition, not a normalization for comparison.
        return string.Join('-', words).ToLowerInvariant();
#pragma warning restore CA1308
    }
}
