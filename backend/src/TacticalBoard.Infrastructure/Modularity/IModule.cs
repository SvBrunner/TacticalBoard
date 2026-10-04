using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace TacticalBoard.Infrastructure.Modularity;

/// <summary>
/// A business module of the modular monolith (arc42 ch. 5.2). The host registers every module's
/// services and maps its endpoints; a module never reaches into another module's internals.
/// </summary>
public interface IModule
{
    /// <summary>The module's name, e.g. <c>Users</c>.</summary>
    string Name { get; }

    /// <summary>Registers the module's services (application services, repositories, EF Core model configuration).</summary>
    void RegisterServices(IServiceCollection services, IConfiguration configuration);

    /// <summary>Maps the module's HTTP endpoints below <c>/api</c>.</summary>
    void MapEndpoints(IEndpointRouteBuilder api);
}
