using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Contracts;
using TacticalBoard.Users.Endpoints;
using TacticalBoard.Users.Infrastructure;

namespace TacticalBoard.Users;

/// <summary>
/// The Users module: local user accounts mapped from the IdP identity, display name, system administrator role, blocking, account deletion, bootstrap of the first system administrator; provides the current user to the other modules.
/// </summary>
public sealed class UsersModule : IModule
{
    /// <inheritdoc />
    public string Name => "Users";

    /// <inheritdoc />
    public void RegisterServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddModelConfigurationFrom(typeof(UsersModule).Assembly);

        services.AddSingleton(BootstrapConfiguration.Read(configuration));
        services.AddScoped<IUserRepository, EfUserRepository>();
        services.AddScoped<SystemAdministratorBootstrap>();
        services.AddScoped<CurrentUserState>();
        services.AddScoped<ICurrentUser>(provider => provider.GetRequiredService<CurrentUserState>());
        services.AddScoped<IUserAuthentication, UserAuthenticationService>();
        services.AddScoped<UserProfileService>();
    }

    /// <inheritdoc />
    public void MapEndpoints(IEndpointRouteBuilder api) => MeEndpoints.Map(api);
}
