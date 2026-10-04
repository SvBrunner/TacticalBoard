using TacticalBoard.Users.Application;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

/// <summary>The bootstrap rule of arc42 ch. 8.14.</summary>
public class SystemAdministratorBootstrapTests
{
    private readonly InMemoryUserRepository _repository = new();

    private SystemAdministratorBootstrap Bootstrap(params string[] configuredSubjects) =>
        new(new BootstrapAdministrators(configuredSubjects.Select(subject => TestUsers.Identity(subject))), _repository);

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Grants_a_configured_identity_on_its_first_login()
    {
        var admin = TestUsers.Create("other");
        admin.GrantSystemAdministrator();
        _repository.Users.Add(admin);
        var user = TestUsers.Create("alice");

        Assert.True(await Bootstrap("alice").ApplyAsync(user, isFirstLogin: true, Cancellation));
        Assert.True(user.IsSystemAdministrator);
    }

    [Fact]
    public async Task Never_grants_an_identity_that_is_not_configured()
    {
        var user = TestUsers.Create("bob");

        Assert.False(await Bootstrap("alice").ApplyAsync(user, isFirstLogin: true, Cancellation));
        Assert.False(user.IsSystemAdministrator);
    }

    [Fact]
    public async Task Grants_a_configured_identity_again_when_no_active_administrator_exists()
    {
        var user = TestUsers.Create("alice");
        _repository.Users.Add(user);

        Assert.True(await Bootstrap("alice").ApplyAsync(user, isFirstLogin: false, Cancellation));
        Assert.True(user.IsSystemAdministrator);
    }

    [Fact]
    public async Task Keeps_a_revoked_role_while_another_administrator_exists()
    {
        var admin = TestUsers.Create("other");
        admin.GrantSystemAdministrator();
        var user = TestUsers.Create("alice");
        _repository.Users.AddRange([admin, user]);

        Assert.False(await Bootstrap("alice").ApplyAsync(user, isFirstLogin: false, Cancellation));
        Assert.False(user.IsSystemAdministrator);
    }

    [Fact]
    public async Task Ignores_blocked_and_deleted_administrators()
    {
        var blocked = TestUsers.Create("blocked");
        blocked.GrantSystemAdministrator();
        blocked.Block();
        var deleted = TestUsers.Create("deleted");
        deleted.GrantSystemAdministrator();
        deleted.MarkDeleted(DateTimeOffset.UnixEpoch);
        var user = TestUsers.Create("alice");
        _repository.Users.AddRange([blocked, deleted, user]);

        Assert.True(await Bootstrap("alice").ApplyAsync(user, isFirstLogin: false, Cancellation));
    }

    [Fact]
    public async Task Does_nothing_for_an_existing_administrator()
    {
        var user = TestUsers.Create("alice");
        user.GrantSystemAdministrator();

        Assert.False(await Bootstrap("alice").ApplyAsync(user, isFirstLogin: false, Cancellation));
        Assert.True(user.IsSystemAdministrator);
    }

    [Fact]
    public async Task Does_not_save()
    {
        await Bootstrap("alice").ApplyAsync(TestUsers.Create("alice"), isFirstLogin: true, Cancellation);

        Assert.Equal(0, _repository.SaveCount);
    }

    [Fact]
    public void The_configured_set_matches_exactly()
    {
        var configured = new BootstrapAdministrators([TestUsers.Identity("alice")]);

        Assert.True(configured.Contains(TestUsers.Identity("alice")));
        Assert.False(configured.Contains(TestUsers.Identity("Alice")));
        Assert.Single(configured.Identities);
        Assert.Empty(BootstrapAdministrators.None.Identities);
    }
}
