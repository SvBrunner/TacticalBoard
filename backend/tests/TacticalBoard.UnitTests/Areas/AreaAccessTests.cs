using TacticalBoard.Areas.Application;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Teams.Contracts;
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

    [Theory]
    [InlineData(TeamRole.Admin, true, true)]
    [InlineData(TeamRole.Editor, true, true)]
    [InlineData(TeamRole.Reader, true, false)]
    public async Task A_team_area_follows_the_members_role(TeamRole role, bool read, bool write)
    {
        var teamId = Guid.NewGuid();
        var teams = new FakeTeamAuthorization { Roles = { [teamId] = role } };
        var access = new AreaAccess(new FakeCurrentUser(Alice), [new PersonalAreaAccessRule(new FakeCurrentUser(Alice)), new TeamAreaAccessRule(teams)]);
        var area = new AreaReference(AreaKind.Team, teamId);

        Assert.Equal((read, write), (await access.CanReadAsync(area, Cancellation), await access.CanWriteAsync(area, Cancellation)));
        Assert.Equal([("read", teamId), ("write", teamId)], teams.Questions);
    }

    [Fact]
    public async Task Non_members_and_system_administrators_without_membership_have_no_access_to_a_team_area()
    {
        var admin = new FakeCurrentUser(Bob) { IsSystemAdministrator = true };
        var access = new AreaAccess(admin, [new TeamAreaAccessRule(new FakeTeamAuthorization())]);
        var area = new AreaReference(AreaKind.Team, Guid.NewGuid());

        Assert.False(await access.CanReadAsync(area, Cancellation));
        Assert.False(await access.CanWriteAsync(area, Cancellation));
    }

    [Fact]
    public async Task The_team_rule_never_grants_another_kind_and_asks_nothing_for_it()
    {
        var teams = new FakeTeamAuthorization { Roles = { [Alice] = TeamRole.Admin } };
        var rule = new TeamAreaAccessRule(teams);

        Assert.Equal(AreaKind.Team, rule.Kind);
        Assert.False(await rule.CanReadAsync(AreaReference.Personal(Alice), Cancellation));
        Assert.False(await rule.CanWriteAsync(AreaReference.Personal(Alice), Cancellation));
        Assert.Empty(teams.Questions);
        await Assert.ThrowsAsync<ArgumentNullException>(() => rule.CanReadAsync(null!, Cancellation));
        await Assert.ThrowsAsync<ArgumentNullException>(() => rule.CanWriteAsync(null!, Cancellation));
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
