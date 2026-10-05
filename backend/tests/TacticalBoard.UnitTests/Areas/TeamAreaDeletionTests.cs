using TacticalBoard.Areas.Application;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.UnitTests.Areas;

public class TeamAreaDeletionTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 5, 12, 0, 0, TimeSpan.Zero);

    private static CancellationToken Cancellation => TestContext.Current.CancellationToken;

    private sealed class RecordingContentDeletion(List<string> log, string name) : IAreaContentDeletion
    {
        public Task DeleteContentAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken)
        {
            log.Add($"{name}:{area.Kind}:{area.OwnerId}:{deletedAt:O}");
            return Task.CompletedTask;
        }
    }

    [Fact]
    public async Task Passes_a_team_deletion_on_to_every_content_of_the_teams_area()
    {
        var log = new List<string>();
        var teamId = Guid.NewGuid();
        var deletion = new TeamAreaDeletion([new RecordingContentDeletion(log, "folders"), new RecordingContentDeletion(log, "situations")]);

        await deletion.TeamDeletingAsync(new TeamDeletion(teamId, Now, Guid.NewGuid()), Cancellation);

        Assert.Equal([$"folders:Team:{teamId}:{Now:O}", $"situations:Team:{teamId}:{Now:O}"], log);
    }

    [Fact]
    public async Task Does_nothing_without_content_modules()
    {
        var deletion = new TeamAreaDeletion([]);

        await deletion.TeamDeletingAsync(new TeamDeletion(Guid.NewGuid(), Now, Guid.NewGuid()), Cancellation);

        await Assert.ThrowsAsync<ArgumentNullException>(() => deletion.TeamDeletingAsync(null!, Cancellation));
    }

    [Fact]
    public async Task A_failing_content_deletion_cancels_the_team_deletion()
    {
        var deletion = new TeamAreaDeletion([new FailingContentDeletion()]);

        await Assert.ThrowsAsync<InvalidOperationException>(() => deletion.TeamDeletingAsync(new TeamDeletion(Guid.NewGuid(), Now, Guid.NewGuid()), Cancellation));
    }

    private sealed class FailingContentDeletion : IAreaContentDeletion
    {
        public Task DeleteContentAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken) =>
            Task.FromException(new InvalidOperationException("cannot delete"));
    }
}
