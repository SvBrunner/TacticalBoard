using TacticalBoard.Users.Application;
using TacticalBoard.Users.Contracts;
using TacticalBoard.Users.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

/// <summary>Just-in-time users, rejection of blocked/deleted users, and per-request session checks.</summary>
public class UserAuthenticationServiceTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 4, 9, 0, 0, TimeSpan.Zero);

    private readonly InMemoryUserRepository _repository = new();
    private readonly CurrentUserState _currentUser = new();
    private BootstrapAdministrators _configured = BootstrapAdministrators.None;

    private UserAuthenticationService Service() =>
        new(_repository, new SystemAdministratorBootstrap(_configured, _repository), _currentUser, new SequenceIdGenerator(), new FixedClock(Now));

    private static ExternalLogin Login(string subject = "alice", string? name = "Alice Example", string? preferredUsername = "alice", string? email = "alice@example.org") =>
        new(TestUsers.Issuer, subject, name, preferredUsername, email);

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Creates_a_normal_user_on_the_first_login()
    {
        var result = await Service().SignInAsync(Login(), Cancellation);

        Assert.True(result.Succeeded);
        var user = Assert.Single(_repository.Users);
        Assert.Equal(result.UserId, user.Id);
        Assert.Equal(new Guid("00000000-0000-0000-0000-000000000001"), user.Id);
        Assert.Equal(TestUsers.Identity("alice"), user.Identity);
        Assert.Equal("Alice Example", user.DisplayName.Value);
        Assert.Equal(Now, user.CreatedAt);
        Assert.False(user.IsSystemAdministrator);
    }

    [Fact]
    public async Task Takes_the_display_name_from_the_fallback_claims()
    {
        await Service().SignInAsync(Login(name: null), Cancellation);

        Assert.Equal("alice", Assert.Single(_repository.Users).DisplayName.Value);
    }

    [Fact]
    public async Task Finds_the_existing_user_on_later_logins_without_overwriting_the_name()
    {
        var first = await Service().SignInAsync(Login(), Cancellation);
        _repository.Users[0].ChangeDisplayName(DisplayName.FromTrusted("Coach"));

        var second = await Service().SignInAsync(Login(name: "Renamed At IdP"), Cancellation);

        Assert.Equal(first.UserId, second.UserId);
        Assert.Equal("Coach", Assert.Single(_repository.Users).DisplayName.Value);
    }

    [Fact]
    public async Task Distinguishes_users_by_issuer_and_subject()
    {
        await Service().SignInAsync(Login("alice"), Cancellation);
        await Service().SignInAsync(Login("bob"), Cancellation);
        await Service().SignInAsync(new ExternalLogin("https://other-idp.example.org", "alice", null, null, null), Cancellation);

        Assert.Equal(3, _repository.Users.Count);
    }

    [Fact]
    public async Task Rejects_a_blocked_user()
    {
        var user = TestUsers.Create("alice");
        user.Block();
        _repository.Users.Add(user);

        var result = await Service().SignInAsync(Login(), Cancellation);

        Assert.False(result.Succeeded);
        Assert.Null(result.UserId);
        Assert.Equal(SignInRejection.Blocked, result.Rejection);
    }

    [Fact]
    public async Task Rejects_a_deleted_user_and_creates_no_new_one()
    {
        var user = TestUsers.Create("alice");
        user.MarkDeleted(Now);
        _repository.Users.Add(user);

        var result = await Service().SignInAsync(Login(), Cancellation);

        Assert.Equal(SignInRejection.Deleted, result.Rejection);
        Assert.Single(_repository.Users);
    }

    [Fact]
    public async Task Rejects_an_unusable_identity()
    {
        var result = await Service().SignInAsync(Login(new string('s', 256)), Cancellation);

        Assert.Equal(SignInRejection.InvalidIdentity, result.Rejection);
        Assert.Empty(_repository.Users);
    }

    [Fact]
    public async Task Makes_a_configured_identity_system_administrator_on_its_first_login()
    {
        _configured = new BootstrapAdministrators([TestUsers.Identity("alice")]);

        await Service().SignInAsync(Login(), Cancellation);

        Assert.True(Assert.Single(_repository.Users).IsSystemAdministrator);
    }

    [Fact]
    public async Task Restores_the_role_of_a_configured_identity_when_no_administrator_is_left()
    {
        _configured = new BootstrapAdministrators([TestUsers.Identity("alice")]);
        var user = TestUsers.Create("alice");
        _repository.Users.Add(user);

        await Service().SignInAsync(Login(), Cancellation);

        Assert.True(user.IsSystemAdministrator);
        Assert.Equal(1, _repository.SaveCount);
    }

    [Fact]
    public async Task Saves_nothing_on_an_ordinary_later_login()
    {
        _repository.Users.Add(TestUsers.Create("alice"));

        await Service().SignInAsync(Login(), Cancellation);

        Assert.Equal(0, _repository.SaveCount);
    }

    [Fact]
    public async Task Continues_with_the_winner_of_a_parallel_first_login()
    {
        var winner = TestUsers.Create("alice", "Winner");
        _repository.ParallelWinner = winner;

        var result = await Service().SignInAsync(Login(), Cancellation);

        Assert.Equal(winner.Id, result.UserId);
        Assert.Single(_repository.Users);
    }

    [Fact]
    public async Task Requires_a_login() =>
        await Assert.ThrowsAsync<ArgumentNullException>(() => Service().SignInAsync(null!, Cancellation));

    [Fact]
    public async Task Resumes_the_session_of_an_active_user()
    {
        var user = TestUsers.Create("alice", "Alice");
        user.GrantSystemAdministrator();
        _repository.Users.Add(user);

        Assert.True(await Service().ResumeSessionAsync(user.Id, Cancellation));

        Assert.True(_currentUser.IsAuthenticated);
        Assert.Equal(user.Id, _currentUser.Id);
        Assert.True(_currentUser.IsSystemAdministrator);
        Assert.Equal("Alice", _currentUser.User.DisplayName);
        Assert.Equal(1, _repository.SessionQueries);
    }

    [Fact]
    public async Task Ends_the_session_of_a_blocked_user()
    {
        var user = TestUsers.Create();
        user.Block();
        _repository.Users.Add(user);

        Assert.False(await Service().ResumeSessionAsync(user.Id, Cancellation));
        Assert.False(_currentUser.IsAuthenticated);
    }

    [Fact]
    public async Task Ends_the_session_of_a_deleted_user()
    {
        var user = TestUsers.Create();
        user.MarkDeleted(Now);
        _repository.Users.Add(user);

        Assert.False(await Service().ResumeSessionAsync(user.Id, Cancellation));
        Assert.False(_currentUser.IsAuthenticated);
    }

    [Fact]
    public async Task Ends_the_session_of_an_unknown_user() =>
        Assert.False(await Service().ResumeSessionAsync(Guid.NewGuid(), Cancellation));
}
