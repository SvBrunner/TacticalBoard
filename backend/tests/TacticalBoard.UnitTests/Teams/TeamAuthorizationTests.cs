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
    }
}
