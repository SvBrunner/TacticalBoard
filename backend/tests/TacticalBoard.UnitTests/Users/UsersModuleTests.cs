using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.Infrastructure;
using TacticalBoard.Users;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Contracts;
using TacticalBoard.Users.Domain;
using TacticalBoard.Users.Infrastructure;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

public class UsersModuleTests
{
    private static ServiceProvider Build(Dictionary<string, string?>? settings = null)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>(settings ?? []) { ["ConnectionStrings:TacticalBoard"] = "Host=unused;Database=unused" })
            .Build();
        var services = new ServiceCollection().AddLogging().AddSingleton<IConfiguration>(configuration);
        services.AddSharedKernelServices().AddPersistence("TacticalBoard.Api");
        new UsersModule().RegisterServices(services, configuration);
        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    [Fact]
    public void Provides_the_current_user_per_request()
    {
        using var services = Build();
        using var first = services.CreateScope();
        using var second = services.CreateScope();

        var current = first.ServiceProvider.GetRequiredService<ICurrentUser>();

        Assert.Same(first.ServiceProvider.GetRequiredService<CurrentUserState>(), current);
        Assert.NotSame(current, second.ServiceProvider.GetRequiredService<ICurrentUser>());
    }

    [Fact]
    public void Provides_the_authentication_for_the_host()
    {
        using var services = Build();
        using var scope = services.CreateScope();

        Assert.IsType<UserAuthenticationService>(scope.ServiceProvider.GetRequiredService<IUserAuthentication>());
        Assert.IsType<EfUserRepository>(scope.ServiceProvider.GetRequiredService<IUserRepository>());
        Assert.NotNull(scope.ServiceProvider.GetRequiredService<UserProfileService>());
    }

    [Fact]
    public void Reads_the_bootstrap_administrators()
    {
        using var services = Build(new() { ["Bootstrap:SystemAdministrators"] = TestUsers.Issuer + "|alice" });

        Assert.True(services.GetRequiredService<BootstrapAdministrators>().Contains(TestUsers.Identity("alice")));
    }

    [Fact]
    public void Maps_the_users_table_with_a_unique_identity()
    {
        using var services = Build();
        using var scope = services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<TacticalBoard.Infrastructure.Persistence.TacticalBoardDbContext>();

        var entity = context.Model.FindEntityType(typeof(User))!;

        Assert.Equal("users", entity.GetTableName());
        var index = Assert.Single(entity.GetIndexes());
        Assert.True(index.IsUnique);
        Assert.Equal(UserConfiguration.IdentityIndexName, index.GetDatabaseName());
        Assert.Equal(["Issuer", "Subject"], index.Properties.Select(property => property.Name));
        Assert.Equal("display_name", entity.FindProperty(nameof(User.DisplayNameValue))!.GetColumnName());
        Assert.Equal(DisplayName.MaxLength, entity.FindProperty(nameof(User.DisplayNameValue))!.GetMaxLength());
        Assert.Equal(ExternalIdentity.MaxSubjectLength, entity.FindProperty(nameof(User.Subject))!.GetMaxLength());
        Assert.NotNull(entity.FindDeclaredQueryFilter(TacticalBoard.Infrastructure.Persistence.SoftDeleteQueryFilter.Name));
        Assert.Equal(
            ["CreatedAt", "DeletedAt", "DisplayNameValue", "Id", "IsBlocked", "IsSystemAdministrator", "Issuer", "Subject"],
            entity.GetProperties().Select(property => property.Name).Order(StringComparer.Ordinal));
    }
}
