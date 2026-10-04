using TacticalBoard.Users.Application;

namespace TacticalBoard.UnitTests.Users;

public class CurrentUserStateTests
{
    private static readonly SessionUser Alice = new(Guid.Parse("0199a6d0-0000-7000-8000-000000000001"), "Alice", IsSystemAdministrator: true, IsBlocked: false);

    [Fact]
    public void Is_anonymous_until_set()
    {
        var state = new CurrentUserState();

        Assert.False(state.IsAuthenticated);
        Assert.False(state.IsSystemAdministrator);
        Assert.Throws<InvalidOperationException>(() => state.Id);
        Assert.Throws<InvalidOperationException>(() => state.User);
    }

    [Fact]
    public void Exposes_the_set_user()
    {
        var state = new CurrentUserState();

        state.Set(Alice);

        Assert.True(state.IsAuthenticated);
        Assert.Equal(Alice.Id, state.Id);
        Assert.True(state.IsSystemAdministrator);
        Assert.Same(Alice, state.User);
    }

    [Fact]
    public void Can_be_refreshed()
    {
        var state = new CurrentUserState();
        state.Set(Alice);

        state.Refresh(Alice with { DisplayName = "Coach" });

        Assert.Equal("Coach", state.User.DisplayName);
    }

    [Fact]
    public void Rejects_null() => Assert.Throws<ArgumentNullException>(() => new CurrentUserState().Set(null!));
}
