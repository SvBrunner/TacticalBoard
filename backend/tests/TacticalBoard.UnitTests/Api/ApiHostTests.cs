using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TacticalBoard.Api.ErrorHandling;
using TacticalBoard.Api.Hosting;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.UnitTests.Api;

public class ApiHostTests
{
    private sealed class SpyModule : IModule
    {
        public string Name => "Spy";

        public bool Registered { get; private set; }

        public void RegisterServices(IServiceCollection services, IConfiguration configuration)
        {
            Registered = true;
            services.AddSingleton(this);
        }

        public void MapEndpoints(IEndpointRouteBuilder api) => api.MapGet("/spy", () => "spy");
    }

    private static WebApplication BuildApp(ApiHost host)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = Environments.Production });
        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused",
        });
        host.ConfigureServices(builder.Services, builder.Configuration);
        var app = builder.Build();
        host.ConfigurePipeline(app);
        return app;
    }

    private static List<string?> RoutePatterns(WebApplication app) =>
        ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(source => source.Endpoints)
            .OfType<RouteEndpoint>()
            .Select(endpoint => endpoint.RoutePattern.RawText)
            .ToList();

    [Fact]
    public async Task Registers_every_modules_services()
    {
        var module = new SpyModule();

        await using var app = BuildApp(new ApiHost([module]));

        Assert.True(module.Registered);
        Assert.Same(module, app.Services.GetRequiredService<SpyModule>());
    }

    [Fact]
    public async Task Maps_module_endpoints_below_api()
    {
        await using var app = BuildApp(new ApiHost([new SpyModule()]));

        Assert.Contains("/api/spy", RoutePatterns(app));
    }

    [Fact]
    public async Task Maps_the_health_endpoint()
    {
        await using var app = BuildApp(new ApiHost([]));

        Assert.Contains("/api/health", RoutePatterns(app));
    }

    [Fact]
    public async Task Registers_the_shared_infrastructure_and_error_handling()
    {
        await using var app = BuildApp(new ApiHost([]));

        Assert.NotNull(app.Services.GetService<IClock>());
        Assert.NotNull(app.Services.GetService<IIdGenerator>());
        Assert.NotNull(app.Services.GetService<IProblemDetailsService>());
        Assert.Contains(app.Services.GetServices<IExceptionHandler>(), handler => handler is DomainExceptionHandler);
        using var scope = app.Services.CreateScope();
        Assert.NotNull(scope.ServiceProvider.GetService<TacticalBoardDbContext>());
    }

    [Fact]
    public void Exposes_its_modules()
    {
        IModule[] modules = [new SpyModule()];

        Assert.Equal(modules, new ApiHost(modules).Modules);
    }

    [Fact]
    public void Catalog_lists_the_five_modules_in_dependency_order() =>
        Assert.Equal(["Users", "Teams", "Areas", "Folders", "Situations"], ModuleCatalog.All.Select(module => module.Name));
}
