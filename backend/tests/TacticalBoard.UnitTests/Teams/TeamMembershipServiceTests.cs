using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamMembershipServiceTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly Guid Carol = Guid.Parse("0199a6d0-0000-7000-8000-00000000000c");

    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryTeamRepository _repository;
    private readonly FakeCurrentUser _currentUser = new(Alice);
    private readonly FixedClock _clock = new(TestTeams.Now.AddDays(1));
    private readonly FakeUserDirectory _users = new(new Dictionary<Guid, string> { [Alice] = "alice", [Bob] = "Bob", [Carol] = "Carol" });
    private readonly Team _team;
    private readonly TeamKey _key;

    public TeamMembershipServiceTests()
    {
        _repository = new InMemoryTeamRepository(_transactions);
        _team = _repository.AddTeam(Alice);
        _key = TeamKey.OfCode(TeamCode.Parse(_team.Code));
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamMembershipService Service =>
        new(_repository, _repository, new TeamAuthorization(_currentUser, _repository), new TeamMemberNames(_users), new TeamLocks(_repository, _transactions), _currentUser, _clock);

    private TeamRole? RoleOf(Guid userId) =>
        _repository.Memberships.SingleOrDefault(membership => membership.UserId == userId && !membership.IsDeleted)?.Role;

    [Theory]
    [InlineData(TeamRole.Admin)]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    public async Task Every_member_sees_the_member_list_by_name(TeamRole role)
    {
        _repository.AddMember(_team, Bob, role);
        _repository.AddMember(_team, Carol, TeamRole.Reader);
        _repository.AddMember(_team, Guid.NewGuid(), TeamRole.Reader);
        _currentUser.UserId = Bob;

        var members = await Service.ListAsync(_key, Cancellation);

        Assert.Equal([("alice", TeamRole.Admin), ("Bob", role), ("Carol", TeamRole.Reader), (null, TeamRole.Reader)], members.Select(member => (member.DisplayName, member.Role)));
        Assert.Equal(1, _users.Queries);
    }

    [Fact]
    public async Task Non_members_and_removed_members_do_not_see_the_member_list()
    {
        _currentUser.UserId = Bob;
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ListAsync(_key, Cancellation));

        var membership = _repository.AddMember(_team, Bob, TeamRole.Reader);
        Assert.Equal(2, (await Service.ListAsync(_key, Cancellation)).Count);
        membership.MarkDeleted(TestTeams.Now);
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ListAsync(_key, Cancellation));
    }

    [Fact]
    public async Task An_Admin_changes_a_role_with_the_team_locked()
    {
        _repository.AddMember(_team, Bob, TeamRole.Reader);

        var member = await Service.ChangeRoleAsync(_key, Bob, TeamRole.Editor, Cancellation);

        Assert.Equal((Bob, "Bob", TeamRole.Editor), (member.UserId, member.DisplayName, member.Role));
        Assert.Equal(TeamRole.Editor, RoleOf(Bob));
        Assert.Equal([(_team.Id, true)], _repository.Locks);
        Assert.Equal(1, _transactions.Transactions);
    }

    [Fact]
    public async Task An_Admin_promotes_someone_and_then_demotes_themselves()
    {
        _repository.AddMember(_team, Bob, TeamRole.Editor);

        await Service.ChangeRoleAsync(_key, Bob, TeamRole.Admin, Cancellation);
        await Service.ChangeRoleAsync(_key, Alice, TeamRole.Reader, Cancellation);

        Assert.Equal((TeamRole.Admin, TeamRole.Reader), (RoleOf(Bob)!.Value, RoleOf(Alice)!.Value));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ChangeRoleAsync(_key, Alice, TeamRole.Admin, Cancellation));
    }

    [Fact]
    public async Task The_last_Admin_can_not_demote_themselves()
    {
        _repository.AddMember(_team, Bob, TeamRole.Editor);

        await Assert.ThrowsAsync<LastTeamAdminException>(() => Service.ChangeRoleAsync(_key, Alice, TeamRole.Editor, Cancellation));

        Assert.Equal(TeamRole.Admin, RoleOf(Alice));
        Assert.Equal(1, _transactions.RolledBack);
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    public async Task Editors_and_Readers_manage_no_members(TeamRole role)
    {
        _repository.AddMember(_team, Bob, role);
        _repository.AddMember(_team, Carol, TeamRole.Reader);
        _currentUser.UserId = Bob;

        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ChangeRoleAsync(_key, Carol, TeamRole.Editor, Cancellation));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ChangeRoleAsync(_key, Bob, TeamRole.Admin, Cancellation));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.RemoveAsync(_key, Carol, Cancellation));
        Assert.Equal((TeamRole.Reader, role), (RoleOf(Carol)!.Value, RoleOf(Bob)!.Value));
    }

    [Fact]
    public async Task An_Admin_removes_a_member_who_then_has_no_access()
    {
        _repository.AddMember(_team, Bob, TeamRole.Editor);

        await Service.RemoveAsync(_key, Bob, Cancellation);

        var removed = _repository.Memberships.Single(membership => membership.UserId == Bob);
        Assert.Equal(_clock.UtcNow, removed.DeletedAt);
        _currentUser.UserId = Bob;
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ListAsync(_key, Cancellation));
    }

    [Fact]
    public async Task An_Admin_removes_another_Admin_but_not_the_last_one()
    {
        _repository.AddMember(_team, Bob, TeamRole.Admin);

        await Service.RemoveAsync(_key, Bob, Cancellation);

        await Assert.ThrowsAsync<LastTeamAdminException>(() => Service.RemoveAsync(_key, Alice, Cancellation));
        Assert.Null(RoleOf(Bob));
    }

    [Fact]
    public async Task Removing_or_changing_a_non_member_is_not_found()
    {
        await Assert.ThrowsAsync<TeamMemberNotFoundException>(() => Service.RemoveAsync(_key, Bob, Cancellation));
        await Assert.ThrowsAsync<TeamMemberNotFoundException>(() => Service.ChangeRoleAsync(_key, Bob, TeamRole.Admin, Cancellation));
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    [InlineData(TeamRole.Admin)]
    public async Task Members_leave(TeamRole role)
    {
        _repository.AddMember(_team, Bob, role);
        _currentUser.UserId = Bob;

        await Service.LeaveAsync(_key, Cancellation);

        Assert.Null(RoleOf(Bob));
        Assert.Equal([(_team.Id, true)], _repository.Locks);
    }

    [Fact]
    public async Task The_last_Admin_can_not_leave_also_as_the_only_member()
    {
        await Assert.ThrowsAsync<LastTeamAdminException>(() => Service.LeaveAsync(_key, Cancellation));

        _repository.AddMember(_team, Bob, TeamRole.Reader);
        await Assert.ThrowsAsync<LastTeamAdminException>(() => Service.LeaveAsync(_key, Cancellation));
        Assert.Equal(TeamRole.Admin, RoleOf(Alice));
    }

    [Fact]
    public async Task A_non_member_can_not_leave()
    {
        _currentUser.UserId = Bob;

        await Assert.ThrowsAsync<TeamMemberNotFoundException>(() => Service.LeaveAsync(_key, Cancellation));
    }

    [Fact]
    public async Task An_unknown_or_deleted_team_is_not_found()
    {
        var unknown = TeamKey.OfCode(TeamCode.Parse("ZZZZZZ"));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.ListAsync(unknown, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.ChangeRoleAsync(unknown, Alice, TeamRole.Admin, Cancellation));

        _team.Delete(TestTeams.Now, Alice);

        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.ListAsync(_key, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.RemoveAsync(_key, Alice, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.LeaveAsync(_key, Cancellation));
    }
}
