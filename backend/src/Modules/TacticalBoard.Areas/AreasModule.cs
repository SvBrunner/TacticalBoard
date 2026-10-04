using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;

namespace TacticalBoard.Areas;

/// <summary>
/// The Areas module: the common abstraction for where situations live (a personal area or a team); answers whether the current user may read or write in an area by asking Users or Teams.
/// </summary>
public sealed class AreasModule : IModule
{
    /// <inheritdoc />
    public string Name => "Areas";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(AreasModule).Assembly);
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api)
    {
        // No endpoints yet.
    }
}
