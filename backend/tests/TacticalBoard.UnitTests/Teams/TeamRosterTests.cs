using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamRosterTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly Guid Carol = Guid.Parse("0199a6d0-0000-7000-8000-00000000000c");

    private readonly Team _team = TestTeams.Team(creator: Alice);

    private TeamRoster Roster(params (Guid User, TeamRole Role)[] members) =>
        new(_team.Id, members.Select(member => TestTeams.Membership(_team, member.User, member.Role)).ToList());

    [Fact]
    public void Changes_any_members_role_while_an_Admin_remains()
    {
        var roster = Roster((Alice, TeamRole.Admin), (Bob, TeamRole.Reader));

        Assert.Equal(TeamRole.Editor, roster.ChangeRole(Bob, TeamRole.Editor).Role);
        Assert.Equal(TeamRole.Admin, roster.ChangeRole(Bob, TeamRole.Admin).Role);
        Assert.Equal(TeamRole.Reader, roster.ChangeRole(Alice, TeamRole.Reader).Role);
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    public void The_last_Admin_keeps_the_role(TeamRole role)
    {
        var roster = Roster((Alice, TeamRole.Admin), (Bob, TeamRole.Editor));

        Assert.Throws<LastTeamAdminException>(() => roster.ChangeRole(Alice, role));
        Assert.Equal(TeamRole.Admin, roster.Find(Alice)!.Role);
    }

    [Fact]
    public void Keeping_the_last_Admins_role_is_no_change()
    {
        var roster = Roster((Alice, TeamRole.Admin));

        Assert.Equal(TeamRole.Admin, roster.ChangeRole(Alice, TeamRole.Admin).Role);
    }

    [Fact]
    public void An_Admin_demotes_another_Admin_or_themselves()
    {
        var roster = Roster((Alice, TeamRole.Admin), (Bob, TeamRole.Admin));

        roster.ChangeRole(Alice, TeamRole.Reader);

        Assert.Throws<LastTeamAdminException>(() => roster.ChangeRole(Bob, TeamRole.Reader));
    }

    [Fact]
    public void Removes_members_but_not_the_last_Admin()
    {
        var roster = Roster((Alice, TeamRole.Admin), (Bob, TeamRole.Reader), (Carol, TeamRole.Admin));

        Assert.Equal(Bob, roster.Remove(Bob).UserId);
        Assert.Equal(Carol, roster.Remove(Carol).UserId);
        Assert.Throws<LastTeamAdminException>(() => roster.Remove(Alice));
        Assert.Equal([Alice], roster.Members.Select(member => member.UserId));
    }

    [Fact]
    public void The_only_member_who_is_Admin_can_not_leave()
    {
        var roster = Roster((Alice, TeamRole.Admin));

        Assert.Throws<LastTeamAdminException>(() => roster.Remove(Alice));
    }

    [Fact]
    public void Non_members_are_not_found()
    {
        var roster = Roster((Alice, TeamRole.Admin));

        Assert.Null(roster.Find(Bob));
        Assert.Throws<TeamMemberNotFoundException>(() => roster.ChangeRole(Bob, TeamRole.Editor));
        Assert.Throws<TeamMemberNotFoundException>(() => roster.Remove(Bob));
    }

    [Fact]
    public void Ignores_deleted_memberships()
    {
        var gone = TestTeams.Membership(_team, Bob, TeamRole.Admin);
        gone.MarkDeleted(TestTeams.Now);
        var roster = new TeamRoster(_team.Id, [TestTeams.Membership(_team, Alice, TeamRole.Admin), gone]);

        Assert.Null(roster.Find(Bob));
        Assert.Throws<LastTeamAdminException>(() => roster.ChangeRole(Alice, TeamRole.Reader));
    }

    [Fact]
    public void Takes_only_the_teams_memberships()
    {
        var other = TestTeams.Team(code: "XYZ789");

        Assert.Throws<ArgumentException>(() => new TeamRoster(_team.Id, [TestTeams.Membership(other, Alice, TeamRole.Admin)]));
        Assert.Throws<ArgumentNullException>(() => new TeamRoster(_team.Id, null!));
        Assert.Equal(_team.Id, Roster().TeamId);
    }

    [Fact]
    public void A_membership_rejects_an_unknown_role()
    {
        var membership = TestTeams.Membership(_team, Bob, TeamRole.Reader);

        Assert.Throws<ArgumentOutOfRangeException>(() => membership.ChangeRole((TeamRole)42));
    }
}
