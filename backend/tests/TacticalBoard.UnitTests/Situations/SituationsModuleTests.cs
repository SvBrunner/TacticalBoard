using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Areas;
using TacticalBoard.Infrastructure;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Situations;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Domain;
using TacticalBoard.Situations.Infrastructure;
using TacticalBoard.Users;

namespace TacticalBoard.UnitTests.Situations;

public class SituationsModuleTests
{
    private static ServiceProvider Build()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused" })
            .Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSharedKernelServices().AddPersistence("TacticalBoard.Api");
        new UsersModule().RegisterServices(services, configuration);
        new AreasModule().RegisterServices(services, configuration);
        new SituationsModule().RegisterServices(services, configuration);
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    [Fact]
    public void Provides_the_service_and_repository_per_request()
    {
        using var services = Build();
        using var scope = services.CreateScope();

        Assert.NotNull(scope.ServiceProvider.GetRequiredService<SituationService>());
        Assert.IsType<EfSituationRepository>(scope.ServiceProvider.GetRequiredService<ISituationRepository>());
    }

    [Fact]
    public void Maps_situations_with_a_partial_unique_title_index_per_area()
    {
        using var services = Build();
        using var scope = services.CreateScope();
        var model = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>().Model;

        var situations = model.FindEntityType(typeof(Situation))!;

        Assert.Equal("situations", situations.GetTableName());
        var index = Assert.Single(situations.GetIndexes());
        Assert.True(index.IsUnique);
        Assert.Equal(SituationConfiguration.TitleIndexName, index.GetDatabaseName());
        Assert.Equal(["AreaKind", "AreaOwnerId", "NormalizedTitle"], index.Properties.Select(property => property.Name));
        Assert.Equal("deleted_at IS NULL", index.GetFilter());
        Assert.Equal("area_id", situations.FindProperty(nameof(Situation.AreaOwnerId))!.GetColumnName());
        Assert.True(situations.FindProperty(nameof(Situation.CurrentRevision))!.IsConcurrencyToken);
        Assert.NotNull(situations.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));
    }

    [Fact]
    public void Maps_revisions_as_jsonb_keyed_by_situation_and_number()
    {
        using var services = Build();
        using var scope = services.CreateScope();
        var model = scope.ServiceProvider.GetRequiredService<TacticalBoardDbContext>().Model;

        var revisions = model.FindEntityType(typeof(SituationRevision))!;

        Assert.Equal("situation_revisions", revisions.GetTableName());
        Assert.Equal(["SituationId", "Number"], revisions.FindPrimaryKey()!.Properties.Select(property => property.Name));
        Assert.Equal(SituationRevisionConfiguration.PrimaryKeyName, revisions.FindPrimaryKey()!.GetName());
        Assert.Equal("jsonb", revisions.FindProperty(nameof(SituationRevision.Document))!.GetColumnType());
        Assert.Equal(typeof(Situation), Assert.Single(revisions.GetForeignKeys()).PrincipalEntityType.ClrType);
    }
}
