using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace TacticalBoard.Api.Health;

/// <summary>
/// The body of <c>GET /api/health</c>: the overall status and the status of each check,
/// e.g. <c>{"status":"Healthy","checks":{"database":"Healthy"}}</c>. Never contains error details.
/// </summary>
public sealed record HealthResponse(string Status, IReadOnlyDictionary<string, string> Checks)
{
    /// <summary>Creates the response for <paramref name="report"/>.</summary>
    public static HealthResponse From(HealthReport report)
    {
        ArgumentNullException.ThrowIfNull(report);
        return new HealthResponse(
            report.Status.ToString(),
            report.Entries.ToDictionary(entry => entry.Key, entry => entry.Value.Status.ToString()));
    }
}
