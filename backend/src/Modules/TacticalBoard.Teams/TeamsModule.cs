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
/// So far (roadmap Phase 2 step 6): creating teams (the creator becomes Admin), the overview with search, a team's page, renaming and the logo (Admins); provides <see cref="ITeamAuthorization"/>.
/// </summary>
public sealed class TeamsModule : IModule
{
    /// <inheritdoc />
    public string Name => "Teams";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(TeamsModule).Assembly);
        services.AddScoped<EfTeamRepository>();
        services.AddScoped<ITeamRepository>(provider => provider.GetRequiredService<EfTeamRepository>());
        services.AddScoped<ITeamMembershipRepository>(provider => provider.GetRequiredService<EfTeamRepository>());
        services.AddScoped<ITeamAuthorization, TeamAuthorization>();
        services.AddSingleton<ITeamCodeGenerator, RandomTeamCodeGenerator>();
        services.AddSingleton<ILogoImageProcessor, SkiaLogoImageProcessor>();
        services.AddScoped<TeamService>();
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api) => TeamEndpoints.Map(api);
}
