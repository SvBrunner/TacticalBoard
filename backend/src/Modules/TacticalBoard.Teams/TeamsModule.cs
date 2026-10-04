using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;

namespace TacticalBoard.Teams;

/// <summary>
/// The Teams module: teams (name, logo, code), overview and search, join requests, memberships and roles, leaving and deleting teams; owns the authorization checks for team content.
/// </summary>
public sealed class TeamsModule : IModule
{
    /// <inheritdoc />
    public string Name => "Teams";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(TeamsModule).Assembly);
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api)
    {
        // No endpoints yet.
    }
}
