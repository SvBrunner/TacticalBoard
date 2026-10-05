using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Areas.Application;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Areas;

/// <summary>
/// The Areas module: the common abstraction for where situations live (a personal area or a team); answers whether the current user may read or write in an area by asking Users or Teams (personal area: its owner; team area: the role matrix); finds a team's area by its code or id (<see cref="IAreaDirectory"/>); passes a team's deletion on to the content of its area (<see cref="IAreaContentDeletion"/>).
/// </summary>
public sealed class AreasModule : IModule
{
    /// <inheritdoc />
    public string Name => "Areas";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(AreasModule).Assembly);
        services.AddScoped<IAreaAccessRule, PersonalAreaAccessRule>();
        services.AddScoped<IAreaAccessRule, TeamAreaAccessRule>();
        services.AddScoped<IAreaAccess, AreaAccess>();
        services.AddScoped<IAreaDirectory, AreaDirectory>();
        services.AddScoped<IActorDirectory, ActorDirectory>();
        services.AddScoped<ITeamDeletionParticipant, TeamAreaDeletion>();
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api)
    {
        // No endpoints yet.
    }
}
