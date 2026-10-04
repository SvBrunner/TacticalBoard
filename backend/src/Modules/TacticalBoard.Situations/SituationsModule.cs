using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;

namespace TacticalBoard.Situations;

/// <summary>
/// The Situations module: situations with their revisions, saving with conflict detection, title uniqueness and default titles, validation of the situation document.
/// </summary>
public sealed class SituationsModule : IModule
{
    /// <inheritdoc />
    public string Name => "Situations";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(SituationsModule).Assembly);
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api)
    {
        // No endpoints yet.
    }
}
