using TacticalBoard.Areas.Contracts;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary>
/// Takes part in deleting a team (Teams' <see cref="ITeamDeletionParticipant"/>, arc42 ch. 5.2, 8.16):
/// the team's area goes with it, so every <see cref="IAreaContentDeletion"/> (Folders and Situations,
/// from roadmap Phase 2 step 8 on) soft-deletes its content of that area, in the deleting transaction.
/// </summary>
internal sealed class TeamAreaDeletion(IEnumerable<IAreaContentDeletion> contents) : ITeamDeletionParticipant
{
    private readonly IReadOnlyList<IAreaContentDeletion> _contents = contents.ToList();

    /// <inheritdoc />
    public async Task TeamDeletingAsync(TeamDeletion deletion, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(deletion);
        var area = new AreaReference(AreaKind.Team, deletion.TeamId);
        foreach (var content in _contents)
        {
            await content.DeleteContentAsync(area, deletion.DeletedAt, cancellationToken);
        }
    }
}
