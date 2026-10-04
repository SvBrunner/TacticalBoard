using TacticalBoard.Areas.Application;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Areas;

public class AreaAccessTests
{
    private static readonly Guid Alice = Guid.NewGuid();
    private static readonly Guid Bob = Guid.NewGuid();

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private static AreaAccess For(Guid? user) =>
        new(new FakeCurrentUser(user), [new PersonalAreaAccessRule(new FakeCurrentUser(user))]);

    [Fact]
    public async Task The_owner_may_read_and_write_their_personal_area()
    {
        var access = For(Alice);

        Assert.True(await access.CanReadAsync(AreaReference.Personal(Alice), Cancellation));
        Assert.True(await access.CanWriteAsync(AreaReference.Personal(Alice), Cancellation));
    }

    [Fact]
    public async Task Nobody_else_may_read_or_write_a_personal_area()
    {
        var access = For(Bob);

        Assert.False(await access.CanReadAsync(AreaReference.Personal(Alice), Cancellation));
        Assert.False(await access.CanWriteAsync(AreaReference.Personal(Alice), Cancellation));
    }

    [Fact]
    public async Task A_system_administrator_has_no_access_to_other_personal_areas()
    {
        var admin = new FakeCurrentUser(Bob) { IsSystemAdministrator = true };
        var access = new AreaAccess(admin, [new PersonalAreaAccessRule(admin)]);

        Assert.False(await access.CanReadAsync(AreaReference.Personal(Alice), Cancellation));
    }

    [Fact]
    public async Task Without_a_session_there_is_no_access()
    {
        var access = For(null);

        Assert.False(await access.CanReadAsync(AreaReference.Personal(Alice), Cancellation));
        Assert.False(await access.CanWriteAsync(AreaReference.Personal(Alice), Cancellation));
    }

    [Fact]
    public async Task An_area_kind_without_a_rule_is_denied()
    {
        var access = For(Alice);
        var team = new AreaReference(AreaKind.Team, Alice);

        Assert.False(await access.CanReadAsync(team, Cancellation));
        Assert.False(await access.CanWriteAsync(team, Cancellation));
    }

    [Fact]
    public async Task The_personal_rule_never_grants_another_kind()
    {
        var rule = new PersonalAreaAccessRule(new FakeCurrentUser(Alice));

        Assert.False(await rule.CanReadAsync(new AreaReference(AreaKind.Team, Alice), Cancellation));
        Assert.Equal(AreaKind.Personal, rule.Kind);
    }

    [Fact]
    public void The_current_users_personal_area()
    {
        Assert.Equal(AreaReference.Personal(Alice), For(Alice).CurrentUsersPersonalArea());
        Assert.Throws<InvalidOperationException>(() => For(null).CurrentUsersPersonalArea());
    }

    [Fact]
    public async Task Rejects_a_missing_area()
    {
        var access = For(Alice);

        await Assert.ThrowsAsync<ArgumentNullException>(() => access.CanReadAsync(null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => access.CanWriteAsync(null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => new PersonalAreaAccessRule(new FakeCurrentUser(Alice)).CanReadAsync(null!, Cancellation));
    }
}
