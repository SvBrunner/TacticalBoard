using Microsoft.Extensions.DependencyInjection;
using TacticalBoard.IntegrationTests.TestSupport;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.IntegrationTests;

/// <summary>The EF Core user repository on PostgreSQL.</summary>
public sealed class UserRepositoryTests(PostgresFixture postgres) : IAsyncLifetime
{
    private readonly string _connectionString = postgres.NewDatabaseConnectionString();
    private ApiFactory _factory = null!;

    public ValueTask InitializeAsync()
    {
        _factory = ApiFactory.WithDatabase(_connectionString);
        _ = _factory.Server;
        return ValueTask.CompletedTask;
    }

    public ValueTask DisposeAsync() => _factory.DisposeAsync();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private async Task<T> WithRepositoryAsync<T>(Func<IUserRepository, Task<T>> action)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<IUserRepository>());
    }

    private static User NewUser(string subject, string issuer = FakeIdentityProvider.Issuer) =>
        User.Register(Guid.CreateVersion7(), new ExternalIdentity(issuer, subject), DisplayName.FromTrusted("User " + subject), DateTimeOffset.UtcNow);

    [Fact]
    public async Task Stores_and_finds_a_user_by_identity_and_id()
    {
        var user = NewUser("alice");
        await WithRepositoryAsync(async users => { await users.AddAsync(user, Cancellation); return 0; });

        var byIdentity = await WithRepositoryAsync(users => users.FindByIdentityIncludingDeletedAsync(user.Identity, Cancellation));
        var byId = await WithRepositoryAsync(users => users.FindAsync(user.Id, Cancellation));
        var session = await WithRepositoryAsync(users => users.FindSessionUserAsync(user.Id, Cancellation));

        Assert.Equal(user.Id, byIdentity!.Id);
        Assert.Equal("User alice", byId!.DisplayName.Value);
        Assert.Equal(new SessionUser(user.Id, "User alice", IsSystemAdministrator: false, IsBlocked: false), session);
    }

    [Fact]
    public async Task A_second_user_with_the_same_identity_is_a_duplicate()
    {
        await WithRepositoryAsync(async users => { await users.AddAsync(NewUser("alice"), Cancellation); return 0; });

        await Assert.ThrowsAsync<DuplicateUserIdentityException>(() =>
            WithRepositoryAsync(async users => { await users.AddAsync(NewUser("alice"), Cancellation); return 0; }));
    }

    [Fact]
    public async Task The_same_subject_at_another_issuer_is_another_user()
    {
        await WithRepositoryAsync(async users => { await users.AddAsync(NewUser("alice"), Cancellation); return 0; });

        await WithRepositoryAsync(async users => { await users.AddAsync(NewUser("alice", "https://other.example.org"), Cancellation); return 0; });
    }

    [Fact]
    public async Task Deleted_users_are_found_only_by_identity()
    {
        var user = NewUser("alice");
        await WithRepositoryAsync(async users => { await users.AddAsync(user, Cancellation); return 0; });
        await UserRows.DeleteAsync(_connectionString, "alice");

        Assert.True((await WithRepositoryAsync(users => users.FindByIdentityIncludingDeletedAsync(user.Identity, Cancellation)))!.IsDeleted);
        Assert.Null(await WithRepositoryAsync(users => users.FindAsync(user.Id, Cancellation)));
        Assert.Null(await WithRepositoryAsync(users => users.FindSessionUserAsync(user.Id, Cancellation)));
        await Assert.ThrowsAsync<DuplicateUserIdentityException>(() =>
            WithRepositoryAsync(async users => { await users.AddAsync(NewUser("alice"), Cancellation); return 0; }));
    }

    [Fact]
    public async Task Knows_whether_an_active_system_administrator_exists()
    {
        Assert.False(await WithRepositoryAsync(users => users.AnyActiveSystemAdministratorAsync(Cancellation)));

        var blocked = NewUser("blocked");
        blocked.GrantSystemAdministrator();
        blocked.Block();
        await WithRepositoryAsync(async users => { await users.AddAsync(blocked, Cancellation); return 0; });
        Assert.False(await WithRepositoryAsync(users => users.AnyActiveSystemAdministratorAsync(Cancellation)));

        var admin = NewUser("admin");
        admin.GrantSystemAdministrator();
        await WithRepositoryAsync(async users => { await users.AddAsync(admin, Cancellation); return 0; });
        Assert.True(await WithRepositoryAsync(users => users.AnyActiveSystemAdministratorAsync(Cancellation)));
    }

    [Fact]
    public async Task Saves_changes_to_a_tracked_user()
    {
        var user = NewUser("alice");
        await WithRepositoryAsync(async users => { await users.AddAsync(user, Cancellation); return 0; });

        await WithRepositoryAsync(async users =>
        {
            var tracked = await users.FindAsync(user.Id, Cancellation);
            tracked!.ChangeDisplayName(DisplayName.FromTrusted("Coach"));
            await users.SaveChangesAsync(Cancellation);
            return 0;
        });

        Assert.Equal("Coach", (await WithRepositoryAsync(users => users.FindAsync(user.Id, Cancellation)))!.DisplayName.Value);
    }
}
