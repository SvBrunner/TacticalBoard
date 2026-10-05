using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Areas;
using TacticalBoard.Folders;
using TacticalBoard.Infrastructure.Modularity;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Situations;
using TacticalBoard.Teams;
using TacticalBoard.Users;

namespace TacticalBoard.UnitTests.Modules;

/// <summary>The modules: each registers its own EF Core model configuration; only Users, Teams, Folders and Situations have endpoints so far.</summary>
public class ModuleTests
{
    public static TheoryData<IModule, string> Modules => new()
    {
        { new UsersModule(), "Users" },
        { new TeamsModule(), "Teams" },
        { new AreasModule(), "Areas" },
        { new FoldersModule(), "Folders" },
        { new SituationsModule(), "Situations" },
    };

    [Theory]
    [MemberData(nameof(Modules))]
    public void Has_its_name(IModule module, string name) => Assert.Equal(name, module.Name);

    [Theory]
    [MemberData(nameof(Modules))]
    public void Registers_the_model_configuration_of_its_own_assembly(IModule module, string name)
    {
        var services = new ServiceCollection();

        module.RegisterServices(services, new ConfigurationBuilder().Build());

        using var provider = services.BuildServiceProvider();
        var configuration = Assert.IsType<AssemblyModelConfiguration>(Assert.Single(provider.GetServices<IModelConfiguration>()));
        Assert.Same(module.GetType().Assembly, configuration.Assembly);
        Assert.Equal("TacticalBoard." + name, configuration.Assembly.GetName().Name);
    }

    public static TheoryData<IModule> ModulesWithoutEndpoints => new(
        Modules.Select(row => (IModule)row.Data.Item1).Where(module => module is not (UsersModule or TeamsModule or FoldersModule or SituationsModule)));

    [Theory]
    [MemberData(nameof(ModulesWithoutEndpoints))]
    public async Task Maps_no_endpoints_yet(IModule module)
    {
        await using var app = WebApplication.CreateBuilder().Build();
        var api = app.MapGroup("/api");

        module.MapEndpoints(api);

        Assert.Empty(((IEndpointRouteBuilder)app).DataSources.SelectMany(source => source.Endpoints));
    }
}
