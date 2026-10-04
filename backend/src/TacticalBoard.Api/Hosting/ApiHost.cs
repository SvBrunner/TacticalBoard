using TacticalBoard.Api.Authentication;
using TacticalBoard.Api.Configuration;
using TacticalBoard.Api.ErrorHandling;
using TacticalBoard.Api.Health;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Modularity;

namespace TacticalBoard.Api.Hosting;

/// <summary>Composes the backend: shared infrastructure, the modules, error handling, the login (BFF) and the HTTP pipeline.</summary>
public sealed class ApiHost(IReadOnlyList<IModule> modules)
{
    /// <summary>The path prefix of every API endpoint.</summary>
    public const string ApiPrefix = "/api";

    /// <summary>The modules this host runs.</summary>
    public IReadOnlyList<IModule> Modules { get; } = modules;

    /// <summary>Registers all services.</summary>
    public void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        services.AddAppOptions();
        services.AddSharedKernelServices();
        services.AddPersistence(migrationsAssembly: typeof(ApiHost).Assembly.GetName().Name!);
        services.AddApiErrorHandling();
        services.AddApiHealthChecks();
        services.AddBffAuthentication(configuration);

        foreach (var module in Modules)
        {
            module.RegisterServices(services, configuration);
        }
    }

    /// <summary>Builds the HTTP pipeline and maps all endpoints.</summary>
    public void ConfigurePipeline(WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();

        var api = app.MapGroup(ApiPrefix);
        app.UseBffAuthentication(api);
        api.MapApiHealth();
        foreach (var module in Modules)
        {
            module.MapEndpoints(api);
        }
    }
}
