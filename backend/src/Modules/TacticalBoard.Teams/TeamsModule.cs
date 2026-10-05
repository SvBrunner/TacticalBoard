using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Endpoints;
using TacticalBoard.Teams.Infrastructure;

namespace TacticalBoard.Teams;

/// <summary>
/// The Teams module: teams (name, logo, code), overview and search, join requests, memberships and roles, leaving and deleting teams; owns the authorization checks for team content.
/// So far (roadmap Phase 2 steps 6 and 7): creating teams (the creator becomes Admin), the overview with search, a team's page, renaming and the logo (Admins), join requests, the member list, roles, removing members, leaving and deleting teams; provides <see cref="ITeamAuthorization"/> and calls every <see cref="ITeamDeletionParticipant"/> when a team is deleted.
/// </summary>
public sealed class TeamsModule : IModule
{
    /// <inheritdoc />
    public string Name => "Teams";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(TeamsModule).Assembly);
        services.AddScoped<ITeamRepository, EfTeamRepository>();
        services.AddScoped<ITeamMembershipRepository, EfTeamMembershipRepository>();
        services.AddScoped<ITeamJoinRequestRepository, EfTeamJoinRequestRepository>();
        services.AddScoped<ITeamAuthorization, TeamAuthorization>();
        services.AddSingleton<ITeamCodeGenerator, RandomTeamCodeGenerator>();
        services.AddSingleton<ILogoImageProcessor, SkiaLogoImageProcessor>();
        services.AddScoped<TeamLocks>();
        services.AddScoped<TeamMemberNames>();
        services.AddScoped<TeamService>();
        services.AddScoped<TeamMembershipService>();
        services.AddScoped<TeamJoinRequestService>();
        services.AddScoped<TeamDeletionService>();
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api) => TeamEndpoints.Map(api);
}
