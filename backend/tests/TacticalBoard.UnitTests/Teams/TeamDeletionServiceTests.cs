using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class TeamDeletionServiceTests
{
    private static readonly Guid Alice = Guid.Parse("0199a6d0-0000-7000-8000-00000000000a");
    private static readonly Guid Bob = Guid.Parse("0199a6d0-0000-7000-8000-00000000000b");

    private readonly FakeUnitOfWork _transactions = new();
    private readonly InMemoryTeamRepository _repository;
    private readonly FakeCurrentUser _currentUser = new(Alice);
    private readonly FixedClock _clock = new(TestTeams.Now.AddDays(1));
    private readonly RecordingTeamDeletionParticipant _participant;
    private readonly Team _team;
    private readonly TeamKey _key;

    public TeamDeletionServiceTests()
    {
        _repository = new InMemoryTeamRepository(_transactions);
        _participant = new RecordingTeamDeletionParticipant(_transactions);
        _team = _repository.AddTeam(Alice);
        _key = TeamKey.OfCode(TeamCode.Parse(_team.Code));
    }

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private TeamDeletionService Service =>
        new(_repository, _repository, _repository, new TeamAuthorization(_currentUser, _repository), [_participant], new TeamLocks(_repository, _transactions), _currentUser, _clock);

    [Fact]
    public async Task An_Admin_deletes_the_team_with_its_memberships_pending_requests_and_content()
    {
        _repository.AddMember(_team, Bob, TeamRole.Editor);
        var pending = _repository.AddJoinRequest(_team, Guid.NewGuid());
        var rejected = _repository.AddJoinRequest(_team, Guid.NewGuid());
        rejected.Reject(TestTeams.Now, Alice);
        _repository.Logos[_team.Id] = TeamLogo.Of(_team.Id, TestTeams.Logo(), TestTeams.Now, Alice);

        await Service.DeleteAsync(_key, Cancellation);

        Assert.Equal((_clock.UtcNow, Alice), (_team.DeletedAt!.Value, _team.UpdatedBy));
        Assert.All(_repository.Memberships, membership => Assert.Equal(_clock.UtcNow, membership.DeletedAt));
        Assert.Equal(_clock.UtcNow, pending.DeletedAt);
        Assert.Null(rejected.DeletedAt);
        Assert.True(_repository.Logos.ContainsKey(_team.Id));
        Assert.Equal([(new TeamDeletion(_team.Id, _clock.UtcNow, Alice), true)], _participant.Deletions);
        Assert.Equal([(_team.Id, true)], _repository.Locks);
    }

    [Theory]
    [InlineData(TeamRole.Editor)]
    [InlineData(TeamRole.Reader)]
    [InlineData(null)]
    public async Task Only_Admins_delete_the_team(TeamRole? role)
    {
        if (role is { } memberRole)
        {
            _repository.AddMember(_team, Bob, memberRole);
        }

        _currentUser.UserId = Bob;

        await Assert.ThrowsAsync<TeamAccessDeniedException>(() => Service.DeleteAsync(_key, Cancellation));

        Assert.False(_team.IsDeleted);
        Assert.Empty(_participant.Deletions);
    }

    [Fact]
    public async Task A_failing_participant_cancels_the_deletion()
    {
        _participant.Failure = new InvalidOperationException("content can't be deleted");

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.DeleteAsync(_key, Cancellation));

        Assert.False(_team.IsDeleted);
        Assert.Equal(1, _transactions.RolledBack);
    }

    [Fact]
    public async Task A_deleted_team_is_not_found_and_its_name_is_free_its_code_not()
    {
        await Service.DeleteAsync(_key, Cancellation);

        await Assert.ThrowsAsync<TeamNotFoundException>(() => Service.DeleteAsync(_key, Cancellation));
        Assert.False(await _repository.IsNameTakenAsync(_team.NormalizedName, null, Cancellation));
        Assert.True(await _repository.IsCodeTakenAsync(TeamCode.Parse(_team.Code), Cancellation));
    }
}
