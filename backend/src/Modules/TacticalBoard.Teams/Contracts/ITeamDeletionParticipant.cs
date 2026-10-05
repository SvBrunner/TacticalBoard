namespace TacticalBoard.Teams.Contracts;

/// <summary>
/// Takes part in deleting a team (arc42 ch. 5.2, 8.16): deleting a team also soft-deletes what other
/// modules keep for it — its folders and situations. Teams may not use those modules (the arrows
/// point to Teams), so it publishes the deletion through this interface and the modules that keep
/// team data implement it (dependency inversion, like account deletion and Users). Areas implements
/// it and passes the deletion on to its own contract for the content of the team's area.
/// <para>
/// Every registered participant is called while the team is being deleted, <b>inside the deleting
/// transaction</b> (with the team row locked); throwing cancels the whole deletion.
/// </para>
/// </summary>
public interface ITeamDeletionParticipant
{
    /// <summary>Soft-deletes what this module keeps for the team being deleted.</summary>
    Task TeamDeletingAsync(TeamDeletion deletion, CancellationToken cancellationToken);
}

/// <summary>A team that is being deleted: which one, when (the soft-delete timestamp) and by whom.</summary>
public sealed record TeamDeletion(Guid TeamId, DateTimeOffset DeletedAt, Guid DeletedBy);
