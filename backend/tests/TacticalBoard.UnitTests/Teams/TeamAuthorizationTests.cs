using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamAuthorizationTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    private readonly InMemoryTeamRepository _repository = new();
    private readonly FakeCurrentUser _currentUser = new(Alice);

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamAuthorization Authorization => new(_currentUser, _repository);

    [Theory]
    [InlineData(TeamRole.Admin, true)]
    [InlineData(TeamRole.Editor, false)]
    [InlineData(TeamRole.Reader, false)]
    public async Task Only_Admins_may_change_the_details(TeamRole role, bool allowed)
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        _repository.AddMember(team, Bob, role);
        _currentUser.UserId = Bob;

        Assert.Equal(role, await Authorization.RoleOfCurrentUserAsync(team.Id, Cancellation));
        Assert.Equal(allowed, await Authorization.CanChangeDetailsAsync(team.Id, Cancellation));
    }

    [Theory]
    [InlineData(TeamRole.Admin, true, true, true, true)]
    [InlineData(TeamRole.Editor, true, false, false, false)]
    [InlineData(TeamRole.Reader, true, false, false, false)]
    public async Task Follows_the_permission_matrix_for_members(TeamRole role, bool seeMembers, bool manageMembers, bool decideJoinRequests, bool deleteTeam)
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        _repository.AddMember(team, Bob, role);
        _currentUser.UserId = Bob;

        Assert.Equal(
            (seeMembers, manageMembers, decideJoinRequests, deleteTeam),
            (await Authorization.CanSeeMembersAsync(team.Id, Cancellation),
                await Authorization.CanManageMembersAsync(team.Id, Cancellation),
                await Authorization.CanDecideJoinRequestsAsync(team.Id, Cancellation),
                await Authorization.CanDeleteTeamAsync(team.Id, Cancellation)));
    }

    [Fact]
    public async Task A_removed_member_loses_every_right_at_once()
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        var membership = _repository.AddMember(team, Bob, TeamRole.Admin);
        _currentUser.UserId = Bob;
        Assert.True(await Authorization.CanManageMembersAsync(team.Id, Cancellation));

        membership.MarkDeleted(TestTeams.Now);

        Assert.Null(await Authorization.RoleOfCurrentUserAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanSeeMembersAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanManageMembersAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanDeleteTeamAsync(team.Id, Cancellation));
    }

    [Fact]
    public async Task Non_members_anonymous_users_and_deleted_teams_have_no_role()
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        _repository.AddMember(team, Alice, TeamRole.Admin);

        _currentUser.UserId = Bob;
        Assert.Null(await Authorization.RoleOfCurrentUserAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanChangeDetailsAsync(team.Id, Cancellation));

        _currentUser.UserId = null;
        Assert.Null(await Authorization.RoleOfCurrentUserAsync(team.Id, Cancellation));

        _currentUser.UserId = Alice;
        Assert.Equal(TeamRole.Admin, await Authorization.RoleOfCurrentUserAsync(team.Id, Cancellation));
        team.MarkDeleted(TestTeams.Now);
        Assert.Null(await Authorization.RoleOfCurrentUserAsync(team.Id, Cancellation));
    }

    [Fact]
    public async Task System_administrators_have_no_role_of_their_own()
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        _currentUser.UserId = Bob;
        _currentUser.IsSystemAdministrator = true;

        Assert.False(await Authorization.CanChangeDetailsAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanSeeMembersAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanManageMembersAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanDecideJoinRequestsAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanDeleteTeamAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanReadContentAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanWriteContentAsync(team.Id, Cancellation));
    }

    [Theory]
    [InlineData(TeamRole.Admin, true, true)]
    [InlineData(TeamRole.Editor, true, true)]
    [InlineData(TeamRole.Reader, true, false)]
    public async Task Members_read_the_content_and_Admins_and_Editors_write_it(TeamRole role, bool read, bool write)
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        _repository.AddMember(team, Bob, role);
        _currentUser.UserId = Bob;

        Assert.Equal(
            (read, write),
            (await Authorization.CanReadContentAsync(team.Id, Cancellation), await Authorization.CanWriteContentAsync(team.Id, Cancellation)));
    }

    [Fact]
    public async Task A_demoted_or_removed_member_loses_content_rights_with_the_next_question()
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        var membership = _repository.AddMember(team, Bob, TeamRole.Editor);
        _currentUser.UserId = Bob;
        Assert.True(await Authorization.CanWriteContentAsync(team.Id, Cancellation));

        membership.ChangeRole(TeamRole.Reader);
        Assert.False(await Authorization.CanWriteContentAsync(team.Id, Cancellation));
        Assert.True(await Authorization.CanReadContentAsync(team.Id, Cancellation));

        membership.MarkDeleted(TestTeams.Now);
        Assert.False(await Authorization.CanReadContentAsync(team.Id, Cancellation));
    }

    [Fact]
    public async Task Non_members_and_anonymous_users_have_no_access_to_the_content()
    {
        var team = TestTeams.Team(creator: Alice);
        _repository.Teams.Add(team);
        _repository.AddMember(team, Alice, TeamRole.Admin);

        _currentUser.UserId = Bob;
        Assert.False(await Authorization.CanReadContentAsync(team.Id, Cancellation));
        _currentUser.UserId = null;
        Assert.False(await Authorization.CanReadContentAsync(team.Id, Cancellation));
        Assert.False(await Authorization.CanWriteContentAsync(team.Id, Cancellation));
    }
}
