using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamJoinRequestTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    private readonly Team _team = TestTeams.Team(creator: Alice);

    [Fact]
    public void Is_sent_pending()
    {
        var id = Guid.NewGuid();

        var request = TeamJoinRequest.Send(id, _team, Bob, TestTeams.Now);

        Assert.Equal((id, _team.Id, Bob, TestTeams.Now, JoinRequestStatus.Pending), (request.Id, request.TeamId, request.UserId, request.RequestedAt, request.Status));
        Assert.True(request.IsPending);
        Assert.Null(request.DecidedAt);
        Assert.Null(request.DecidedBy);
    }

    [Fact]
    public void Needs_ids_and_a_team()
    {
        Assert.Throws<ArgumentException>(() => TeamJoinRequest.Send(Guid.Empty, _team, Bob, TestTeams.Now));
        Assert.Throws<ArgumentException>(() => TeamJoinRequest.Send(Guid.NewGuid(), _team, Guid.Empty, TestTeams.Now));
        Assert.Throws<ArgumentNullException>(() => TeamJoinRequest.Send(Guid.NewGuid(), null!, Bob, TestTeams.Now));
    }

    [Fact]
    public void Is_accepted_by_an_Admin_and_makes_a_Reader()
    {
        var request = TeamJoinRequest.Send(Guid.NewGuid(), _team, Bob, TestTeams.Now);
        var later = TestTeams.Now.AddHours(1);

        request.Accept(later, Alice);
        var membership = TeamMembership.ForAcceptedRequest(Guid.NewGuid(), request, later);

        Assert.Equal((JoinRequestStatus.Accepted, later, Alice), (request.Status, request.DecidedAt!.Value, request.DecidedBy!.Value));
        Assert.False(request.IsPending);
        Assert.Equal((_team.Id, Bob, TeamRole.Reader, later), (membership.TeamId, membership.UserId, membership.Role, membership.JoinedAt));
    }

    [Fact]
    public void Is_rejected_by_an_Admin()
    {
        var request = TeamJoinRequest.Send(Guid.NewGuid(), _team, Bob, TestTeams.Now);

        request.Reject(TestTeams.Now, Alice);

        Assert.Equal(JoinRequestStatus.Rejected, request.Status);
        Assert.Throws<InvalidOperationException>(() => TeamMembership.ForAcceptedRequest(Guid.NewGuid(), request, TestTeams.Now));
    }

    [Fact]
    public void Is_decided_only_once()
    {
        var request = TeamJoinRequest.Send(Guid.NewGuid(), _team, Bob, TestTeams.Now);
        request.Reject(TestTeams.Now, Alice);

        Assert.Throws<InvalidOperationException>(() => request.Accept(TestTeams.Now, Alice));
        Assert.Throws<InvalidOperationException>(() => request.Reject(TestTeams.Now, Alice));
    }

    [Fact]
    public void A_pending_request_makes_no_member()
    {
        var request = TeamJoinRequest.Send(Guid.NewGuid(), _team, Bob, TestTeams.Now);

        Assert.Throws<InvalidOperationException>(() => TeamMembership.ForAcceptedRequest(Guid.NewGuid(), request, TestTeams.Now));
        request.Accept(TestTeams.Now, Alice);
        Assert.Throws<ArgumentException>(() => TeamMembership.ForAcceptedRequest(Guid.Empty, request, TestTeams.Now));
        Assert.Throws<ArgumentNullException>(() => TeamMembership.ForAcceptedRequest(Guid.NewGuid(), null!, TestTeams.Now));
    }
}
