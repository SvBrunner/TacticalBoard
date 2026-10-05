using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// Deleting a team (arc42 ch. 1, 8.16, 8.17; Admins only, the UI asks for confirmation first): in one
/// transaction with the team locked it soft-deletes the team, its memberships and its pending join
/// requests, and tells every <see cref="ITeamDeletionParticipant"/> (the modules that keep the team's
/// folders and situations, roadmap Phase 2 step 8) to soft-delete theirs. The logo row stays with the
/// soft-deleted team (it is only reachable through the team). Its name is free again; its code is never
/// given to another team. Members lose access with their next request.
/// </summary>
internal sealed class TeamDeletionService(
    ITeamMembershipRepository memberships,
    ITeamJoinRequestRepository joinRequests,
    ITeamRepository teams,
    ITeamAuthorization authorization,
    IEnumerable<ITeamDeletionParticipant> participants,
    TeamLocks locks,
    ICurrentUser currentUser,
    IClock clock)
{
    private readonly IReadOnlyList<ITeamDeletionParticipant> _participants = participants.ToList();

    /// <summary>Soft-deletes the team with everything that belongs to it. Admins only.</summary>
    /// <exception cref="TeamNotFoundException">There is no such team (any more).</exception>
    /// <exception cref="TeamAccessDeniedException">The current user is not its Admin.</exception>
    public Task DeleteAsync(TeamKey key, CancellationToken cancellationToken) =>
        locks.RunAsync(
            key,
            async (team, cancellation) =>
            {
                if (!await authorization.CanDeleteTeamAsync(team.Id, cancellation))
                {
                    throw new TeamAccessDeniedException("Only the team's Admins may delete it.");
                }

                var deletion = new TeamDeletion(team.Id, clock.UtcNow, currentUser.Id);
                foreach (var participant in _participants)
                {
                    await participant.TeamDeletingAsync(deletion, cancellation);
                }

                await joinRequests.DeletePendingOfTeamAsync(team.Id, deletion.DeletedAt, cancellation);
                await memberships.DeleteAllOfTeamAsync(team.Id, deletion.DeletedAt, cancellation);
                team.Delete(deletion.DeletedAt, deletion.DeletedBy);
                await teams.SaveChangesAsync(cancellation);
                return true;
            },
            cancellationToken);
}
