using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Areas;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.Folders.Infrastructure;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.UnitTests.TestSupport;
using TacticalBoard.Teams;
using TacticalBoard.Users;

namespace TacticalBoard.UnitTests.Folders;

public class FoldersModuleTests
{
    private static ServiceProvider Build()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused" })
            .Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSharedKernelServices().AddPersistence("TacticalBoard.Api");
        new UsersModule().RegisterServices(services, configuration);
        new TeamsModule().RegisterServices(services, configuration);
        new AreasModule().RegisterServices(services, configuration);
        new FoldersModule().RegisterServices(services, configuration);

        // Registered by the Situations module in the app.
        services.AddScoped<IFolderContents, FakeFolderContents>();
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    [Fact]
    public void Provides_the_service_repository_and_directory_per_request()
    {
        using var services = Build();
        using var scope = services.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetRequiredService<FolderService>());
        Assert.IsType<EfFolderRepository>(scope.ServiceProvider.GetRequiredService<IFolderRepository>());
        Assert.IsType<FolderDirectory>(scope.ServiceProvider.GetRequiredService<IFolderDirectory>());
        Assert.IsType<EfUnitOfWork>(scope.ServiceProvider.GetRequiredService<IUnitOfWork>());
        Assert.IsType<FolderAreaContentDeletion>(Assert.Single(scope.ServiceProvider.GetServices<IAreaContentDeletion>()));
    }

    [Fact]
    public void Maps_folders_with_a_partial_unique_name_index_per_area()
    {
        using var services = Build();
        using var scope = services.CreateScope();
        var model = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>().Model;

        var folders = model.FindEntityType(typeof(Folder))!;

        Assert.Equal("folders", folders.GetTableName());
        var index = Assert.Single(folders.GetIndexes());
        Assert.True(index.IsUnique);
        Assert.Equal(FolderConfiguration.NameIndexName, index.GetDatabaseName());
        Assert.Equal(["AreaKind", "AreaOwnerId", "NormalizedName"], index.Properties.Select(property => property.Name));
        Assert.Equal("deleted_at IS NULL", index.GetFilter());
        Assert.Equal("area_id", folders.FindProperty(nameof(Folder.AreaOwnerId))!.GetColumnName());
        Assert.Equal(FolderName.MaxLength, folders.FindProperty(nameof(Folder.Name))!.GetMaxLength());
        Assert.NotNull(folders.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));
    }
}
