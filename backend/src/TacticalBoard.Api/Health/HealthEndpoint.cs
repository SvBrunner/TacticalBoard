using System.Text.Json;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace TacticalBoard.Api.Health;

/// <summary>
/// <c>GET /api/health</c>: 200 with status <c>Healthy</c> when the backend and its database work,
/// 503 with <c>Unhealthy</c> otherwise. Used by the reverse proxy, Compose and monitoring.
/// </summary>
public static class HealthEndpoint
{
    /// <summary>The path below the API prefix.</summary>
    public const string Path = "/health";

    /// <summary>The name of the database check.</summary>
    public const string DatabaseCheckName = "database";

    private static readonly TimeSpan DatabaseCheckTimeout = TimeSpan.FromSeconds(5);

    /// <summary>Registers the health checks.</summary>
    public static IServiceCollection AddApiHealthChecks(this IServiceCollection services)
    {
        services.AddHealthChecks()
            .AddCheck<DatabaseHealthCheck>(DatabaseCheckName, HealthStatus.Unhealthy, tags: [], timeout: DatabaseCheckTimeout);
        return services;
    }

    /// <summary>Maps the endpoint (GET only).</summary>
    public static IEndpointConventionBuilder MapApiHealth(this IEndpointRouteBuilder api) =>
        api.MapHealthChecks(Path, new HealthCheckOptions { ResponseWriter = WriteResponseAsync })
            .WithMetadata(new HttpMethodMetadata([HttpMethods.Get, HttpMethods.Head]));

    /// <summary>Writes <paramref name="report"/> as a <see cref="HealthResponse"/> JSON body.</summary>
    public static Task WriteResponseAsync(HttpContext httpContext, HealthReport report)
    {
        ArgumentNullException.ThrowIfNull(httpContext);
        httpContext.Response.ContentType = "application/json; charset=utf-8";
        return JsonSerializer.SerializeAsync(
            httpContext.Response.Body,
            HealthResponse.From(report),
            JsonSerializerOptions.Web,
            httpContext.RequestAborted);
    }
}
