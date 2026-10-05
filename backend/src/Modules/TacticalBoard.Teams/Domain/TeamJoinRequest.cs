using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// A user's request to join a team (arc42 ch. 1, 8.17): sent by a logged-in non-member (also after
/// arriving through the team's link), accepted or rejected by a team Admin. At most one pending
/// request per user and team; it can't be withdrawn; after a rejection the user may send a new one.
/// Decided requests stay as history. Soft-deleted (ch. 8.16) when the team is deleted while it is
/// still pending.
/// </summary>
internal sealed class TeamJoinRequest : SoftDeletableEntity
{
    // For EF Core.
    private TeamJoinRequest()
    {
    }

    public Guid Id { get; private set; }

    public Guid TeamId { get; private set; }

    /// <summary>The user who wants to join.</summary>
    public Guid UserId { get; private set; }

    public DateTimeOffset RequestedAt { get; private set; }

    public JoinRequestStatus Status { get; private set; }

    /// <summary>When an Admin accepted or rejected it; <c>null</c> while pending.</summary>
    public DateTimeOffset? DecidedAt { get; private set; }

    /// <summary>The Admin who accepted or rejected it; <c>null</c> while pending.</summary>
    public Guid? DecidedBy { get; private set; }

    /// <summary>Whether it is still waiting for a decision.</summary>
    public bool IsPending => Status == JoinRequestStatus.Pending;

    /// <summary>A new, pending request of <paramref name="userId"/> to join <paramref name="team"/>.</summary>
    public static TeamJoinRequest Send(Guid id, Team team, Guid userId, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(team);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("The user id must not be empty.", nameof(userId));
        }

        return new TeamJoinRequest { Id = id, TeamId = team.Id, UserId = userId, RequestedAt = at, Status = JoinRequestStatus.Pending };
    }

    /// <summary>Accepts the request; the caller adds the membership (<see cref="TeamMembership.ForAcceptedRequest"/>).</summary>
    /// <exception cref="InvalidOperationException">It is no longer pending.</exception>
    public void Accept(DateTimeOffset at, Guid by) => Decide(JoinRequestStatus.Accepted, at, by);

    /// <summary>Rejects the request; the user may send a new one.</summary>
    /// <exception cref="InvalidOperationException">It is no longer pending.</exception>
    public void Reject(DateTimeOffset at, Guid by) => Decide(JoinRequestStatus.Rejected, at, by);

    private void Decide(JoinRequestStatus status, DateTimeOffset at, Guid by)
    {
        if (!IsPending)
        {
            throw new InvalidOperationException($"The join request was already {Status.ToString().ToLowerInvariant()}.");
        }

        Status = status;
        DecidedAt = at;
        DecidedBy = by;
    }
}
