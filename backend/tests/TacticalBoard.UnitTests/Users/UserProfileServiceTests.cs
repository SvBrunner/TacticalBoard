using TacticalBoard.Users.Application;
using TacticalBoard.Users.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Users;

public class UserProfileServiceTests
{
    private readonly InMemoryUserRepository _repository = new();
    private readonly CurrentUserState _currentUser = new();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Changes_and_saves_the_current_users_display_name()
    {
        var user = TestUsers.Create("alice", "Alice");
        _repository.Users.Add(user);
        _currentUser.Set(new SessionUser(user.Id, "Alice", IsSystemAdministrator: false, IsBlocked: false));

        var updated = await new UserProfileService(_repository, _currentUser)
            .ChangeDisplayNameAsync(DisplayName.FromTrusted("Coach"), Cancellation);

        Assert.Equal("Coach", user.DisplayName.Value);
        Assert.Equal(1, _repository.SaveCount);
        Assert.Equal("Coach", updated.DisplayName);
        Assert.Equal("Coach", _currentUser.User.DisplayName);
    }

    [Fact]
    public async Task Needs_a_current_user() =>
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new UserProfileService(_repository, _currentUser).ChangeDisplayNameAsync(DisplayName.FromTrusted("Coach"), Cancellation));

    [Fact]
    public async Task Fails_when_the_user_vanished()
    {
        _currentUser.Set(new SessionUser(Guid.NewGuid(), "Ghost", IsSystemAdministrator: false, IsBlocked: false));

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new UserProfileService(_repository, _currentUser).ChangeDisplayNameAsync(DisplayName.FromTrusted("Coach"), Cancellation));
    }

    [Fact]
    public async Task Requires_a_name() =>
        await Assert.ThrowsAsync<ArgumentNullException>(() =>
            new UserProfileService(_repository, _currentUser).ChangeDisplayNameAsync(null!, Cancellation));
}
