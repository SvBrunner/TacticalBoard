using Microsoft.AspNetCore.Http.HttpResults;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Teams.Endpoints;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamMemberEndpointsTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryTeamRepository _repository;
    private readonly FakeCurrentUser _currentUser = new(Alice);
    private readonly FixedClock _clock = new(TestTeams.Now);
    private readonly FakeUserDirectory _users = new(new Dictionary<Guid, string> { [Alice] = "Alice", [Bob] = "Bob" });
    private readonly Team _team;

    public TeamMemberEndpointsTests()
    {
        _repository = new InMemoryTeamRepository(_transactions);
        _team = _repository.AddTeam(Alice);
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamAuthorization Authorization => new(_currentUser, _repository);

    private TeamLocks Locks => new(_repository, _transactions);

    private TeamMembershipService Members =>
        new(_repository, _repository, Authorization, new TeamMemberNames(_users), Locks, _currentUser, _clock);

    private TeamJoinRequestService JoinRequests =>
        new(_repository, _repository, _repository, Authorization, new TeamMemberNames(_users), Locks, _currentUser, new SequenceIdGenerator(), _clock);

    private TeamDeletionService Deletion =>
        new(_repository, _repository, _repository, Authorization, [], Locks, _currentUser, _clock);

    private static Dictionary<string, string> FieldCodes(ValidationProblem problem) =>
        ((IReadOnlyDictionary<string, IReadOnlyDictionary<string, object>[]>)problem.ProblemDetails.Extensions["fieldErrors"]!)
            .ToDictionary(entry => entry.Key, entry => (string)entry.Value.Single()["code"]);

    [Fact]
    public async Task Get_members_lists_names_and_roles_in_lower_case()
    {
        _repository.AddMember(_team, Bob, TeamRole.Editor);

        var result = await TeamMemberEndpoints.ListMembersAsync("abc123", Members, Cancellation);

        Assert.Equal([("Alice", "admin"), ("Bob", "editor")], result.Value!.Select(member => (member.DisplayName, member.Role)));
        Assert.Equal(TestTeams.Now, result.Value![0].JoinedAt);
    }

    [Fact]
    public async Task Put_role_changes_a_role_by_the_teams_id_or_code()
    {
        _repository.AddMember(_team, Bob, TeamRole.Reader);

        var result = await TeamMemberEndpoints.ChangeRoleAsync(_team.Id.ToString(), Bob, new TeamRoleRequest("Admin"), Members, Cancellation);

        var member = Assert.IsType<Ok<TeamMemberResponse>>(result.Result).Value!;
        Assert.Equal((Bob, "Bob", "admin"), (member.UserId, member.DisplayName, member.Role));
    }

    [Theory]
    [InlineData(null, "required")]
    [InlineData(" ", "required")]
    [InlineData("owner", "invalid-value")]
    public async Task Put_role_needs_a_known_role(string? role, string code)
    {
        _repository.AddMember(_team, Bob, TeamRole.Reader);

        var result = await TeamMemberEndpoints.ChangeRoleAsync("ABC123", Bob, new TeamRoleRequest(role), Members, Cancellation);

        Assert.Equal(new Dictionary<string, string> { [TeamMemberEndpoints.RoleField] = code }, FieldCodes(Assert.IsType<ValidationProblem>(result.Result)));
    }

    [Fact]
    public async Task A_malformed_team_is_not_found()
    {
        await Assert.ThrowsAsync<TeamNotFoundException>(() => TeamMemberEndpoints.ChangeRoleAsync("nope", Bob, new TeamRoleRequest("admin"), Members, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => TeamMemberEndpoints.ListMembersAsync("nope", Members, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => TeamMemberEndpoints.SendJoinRequestAsync("nope", JoinRequests, Cancellation));
    }

    [Fact]
    public async Task Delete_removes_a_member_and_delete_me_leaves()
    {
        _repository.AddMember(_team, Bob, TeamRole.Admin);

        Assert.IsType<NoContent>(await TeamMemberEndpoints.RemoveMemberAsync("ABC123", Bob, Members, Cancellation));
        await Assert.ThrowsAsync<LastTeamAdminException>(() => TeamMemberEndpoints.LeaveAsync("ABC123", Members, Cancellation));

        _repository.AddMember(_team, Bob, TeamRole.Reader);
        _currentUser.UserId = Bob;
        Assert.IsType<NoContent>(await TeamMemberEndpoints.LeaveAsync("ABC123", Members, Cancellation));
        Assert.Single(_repository.Memberships, membership => !membership.IsDeleted);
    }

    [Fact]
    public async Task Join_requests_are_sent_listed_accepted_and_rejected()
    {
        _currentUser.UserId = Bob;
        var sent = await TeamMemberEndpoints.SendJoinRequestAsync("ABC123", JoinRequests, Cancellation);
        Assert.Equal((Bob, "Bob", TestTeams.Now), (sent.Value!.User.Id, sent.Value.User.DisplayName, sent.Value.RequestedAt));

        _currentUser.UserId = Alice;
        var listed = await TeamMemberEndpoints.ListJoinRequestsAsync("ABC123", JoinRequests, Cancellation);
        Assert.Equal([sent.Value.Id], listed.Value!.Select(request => request.Id));

        Assert.IsType<NoContent>(await TeamMemberEndpoints.RejectJoinRequestAsync("ABC123", sent.Value.Id, JoinRequests, Cancellation));
        _currentUser.UserId = Bob;
        var again = await TeamMemberEndpoints.SendJoinRequestAsync("ABC123", JoinRequests, Cancellation);
        _currentUser.UserId = Alice;
        var accepted = await TeamMemberEndpoints.AcceptJoinRequestAsync("ABC123", again.Value!.Id, JoinRequests, Cancellation);
        Assert.Equal((Bob, "reader"), (accepted.Value!.UserId, accepted.Value.Role));
    }

    [Fact]
    public async Task Delete_team_soft_deletes_it()
    {
        Assert.IsType<NoContent>(await TeamEndpoints.DeleteAsync("abc123", Deletion, Cancellation));

        Assert.True(_team.IsDeleted);
        await Assert.ThrowsAsync<TeamNotFoundException>(() => TeamEndpoints.DeleteAsync("abc123", Deletion, Cancellation));
    }
}
