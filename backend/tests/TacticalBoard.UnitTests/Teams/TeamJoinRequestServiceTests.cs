using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamJoinRequestServiceTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");
    private static readonly Guid Carol = Guid.Parse("0199a6d0-0000-7000-8000-00000000000c");

    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryTeamRepository _repository;
    private readonly FakeCurrentUser _currentUser = new(Bob);
    private readonly FixedClock _clock = new(TestTeams.Now.AddDays(1));
    private readonly SequenceIdGenerator _ids = new();
    private readonly FakeUserDirectory _users = new(new Dictionary<Guid, string> { [Alice] = "Alice", [Bob] = "Bob", [Carol] = "Carol" });
    private readonly Team _team;
    private readonly TeamKey _key;

    public TeamJoinRequestServiceTests()
    {
        _repository = new InMemoryTeamRepository(_transactions);
        _team = _repository.AddTeam(Alice);
        _key = TeamKey.OfId(_team.Id);
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamJoinRequestService Service =>
        new(_repository, _repository, _repository, new TeamAuthorization(_currentUser, _repository), new TeamMemberNames(_users), new TeamLocks(_repository, _transactions), _currentUser, _ids, _clock);

    private async Task<JoinRequestView> SendAsAsync(Guid userId)
    {
        _currentUser.UserId = userId;
        var request = await Service.SendAsync(_key, Cancellation);
        _currentUser.UserId = Alice;
        return request;
    }

    [Fact]
    public async Task A_non_member_sends_a_pending_request_with_the_team_locked()
    {
        var request = await Service.SendAsync(_key, Cancellation);

        Assert.Equal((Bob, "Bob", _clock.UtcNow), (request.UserId, request.DisplayName, request.RequestedAt));
        var stored = Assert.Single(_repository.JoinRequests);
        Assert.Equal((request.Id, _team.Id, JoinRequestStatus.Pending), (stored.Id, stored.TeamId, stored.Status));
        Assert.Equal([(_team.Id, true)], _repository.Locks);
    }

    [Fact]
    public async Task Only_one_request_is_pending_per_user_and_team()
    {
        await Service.SendAsync(_key, Cancellation);

        await Assert.ThrowsAsync<JoinRequestPendingException>(() => Service.SendAsync(_key, Cancellation));
        Assert.Single(_repository.JoinRequests);
    }

    [Fact]
    public async Task A_request_sent_in_parallel_counts_as_pending()
    {
        _repository.JoinRequestTakenInParallel = true;

        await Assert.ThrowsAsync<JoinRequestPendingException>(() => Service.SendAsync(_key, Cancellation));
    }

    [Theory]
    [InlineData(TeamRole.Admin)]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    public async Task Members_can_not_ask_to_join(TeamRole role)
    {
        _repository.AddMember(_team, Bob, role);

        await Assert.ThrowsAsync<AlreadyTeamMemberException>(() => Service.SendAsync(_key, Cancellation));
        Assert.Empty(_repository.JoinRequests);
    }

    [Fact]
    public async Task Admins_see_the_pending_requests_oldest_first()
    {
        await SendAsAsync(Carol);
        _clock.UtcNow = _clock.UtcNow.AddMinutes(1);
        await SendAsAsync(Bob);
        var stranger = Guid.NewGuid();
        _clock.UtcNow = _clock.UtcNow.AddMinutes(1);
        await SendAsAsync(stranger);

        var pending = await Service.ListPendingAsync(_key, Cancellation);

        Assert.Equal([(Carol, "Carol"), (Bob, "Bob"), (stranger, null)], pending.Select(request => (request.UserId, request.DisplayName)));
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    [InlineData(null)]
    public async Task Only_Admins_see_and_decide_requests(TeamRole? role)
    {
        var request = await SendAsAsync(Bob);
        if (role is { } memberRole)
        {
            _repository.AddMember(_team, Carol, memberRole);
        }

        _currentUser.UserId = Carol;

        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.ListPendingAsync(_key, Cancellation));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.AcceptAsync(_key, request.Id, Cancellation));
        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.RejectAsync(_key, request.Id, Cancellation));
        Assert.True(_repository.JoinRequests.Single().IsPending);
    }

    [Fact]
    public async Task Accepting_makes_the_user_a_Reader()
    {
        var request = await SendAsAsync(Bob);

        var member = await Service.AcceptAsync(_key, request.Id, Cancellation);

        Assert.Equal((Bob, "Bob", TeamRole.Reader, _clock.UtcNow), (member.UserId, member.DisplayName, member.Role, member.JoinedAt));
        var stored = Assert.Single(_repository.JoinRequests);
        Assert.Equal((JoinRequestStatus.Accepted, _clock.UtcNow, Alice), (stored.Status, stored.DecidedAt!.Value, stored.DecidedBy!.Value));
        Assert.Contains(_repository.Memberships, membership => membership.UserId == Bob && membership.Role == TeamRole.Reader && !membership.IsDeleted);
        Assert.Empty(await Service.ListPendingAsync(_key, Cancellation));
    }

    [Fact]
    public async Task After_a_rejection_the_user_may_ask_again()
    {
        var first = await SendAsAsync(Bob);

        await Service.RejectAsync(_key, first.Id, Cancellation);

        Assert.Equal(JoinRequestStatus.Rejected, _repository.JoinRequests.Single().Status);
        Assert.DoesNotContain(_repository.Memberships, membership => membership.UserId == Bob);
        var second = await SendAsAsync(Bob);
        Assert.NotEqual(first.Id, second.Id);
        Assert.Equal([second.Id], (await Service.ListPendingAsync(_key, Cancellation)).Select(request => request.Id));
    }

    [Fact]
    public async Task A_decided_or_unknown_request_is_not_found()
    {
        var request = await SendAsAsync(Bob);
        await Service.AcceptAsync(_key, request.Id, Cancellation);

        await Assert.ThrowsAsync<JoinRequestNotFoundException>(() => Service.AcceptAsync(_key, request.Id, Cancellation));
        await Assert.ThrowsAsync<JoinRequestNotFoundException>(() => Service.RejectAsync(_key, request.Id, Cancellation));
        await Assert.ThrowsAsync<JoinRequestNotFoundException>(() => Service.RejectAsync(_key, Guid.NewGuid(), Cancellation));
    }

    [Fact]
    public async Task A_request_of_another_team_is_not_found()
    {
        var other = _repository.AddTeam(Alice, "Tigers", "XYZ789");
        _currentUser.UserId = Bob;
        var request = await Service.SendAsync(TeamKey.OfId(other.Id), Cancellation);
        _currentUser.UserId = Alice;

        await Assert.ThrowsAsync<JoinRequestNotFoundException>(() => Service.AcceptAsync(_key, request.Id, Cancellation));
    }

    [Fact]
    public async Task A_deleted_team_takes_no_requests()
    {
        _team.Delete(TestTeams.Now, Alice);

        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.SendAsync(_key, Cancellation));
        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.ListPendingAsync(_key, Cancellation));
    }
}
