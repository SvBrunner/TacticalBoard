using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Areas;
using TacticalBoard.Areas.Application;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Infrastructure;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams;
using TacticalBoard.Users;

namespace TacticalBoard.UnitTests.Areas;

public class AreasModuleTests
{
    [Fact]
    public void Provides_area_access_and_the_actor_directory_per_request()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused" })
            .Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSharedKernelServices().AddPersistence("TacticalBoard.Api");
        new UsersModule().RegisterServices(services, configuration);
        new TeamsModule().RegisterServices(services, configuration);
        new AreasModule().RegisterServices(services, configuration);
        using var provider = services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
        using var scope = provider.CreateScope();

        Assert.IsType<AreaAccess>(scope.ServiceProvider.GetRequiredService<IAreaAccess>());
        Assert.IsType<ActorDirectory>(scope.ServiceProvider.GetRequiredService<IActorDirectory>());
        Assert.IsType<AreaDirectory>(scope.ServiceProvider.GetRequiredService<IAreaDirectory>());
        Assert.Equal([AreaKind.Personal, AreaKind.Team], scope.ServiceProvider.GetServices<IAreaAccessRule>().Select(rule => rule.Kind));
        Assert.IsType<TeamAreaDeletion>(Assert.Single(scope.ServiceProvider.GetServices<ITeamDeletionParticipant>()));

        // Folders and Situations register theirs (FoldersModuleTests, SituationsModuleTests).
        Assert.Empty(scope.ServiceProvider.GetServices<IAreaContentDeletion>());
    }
}
