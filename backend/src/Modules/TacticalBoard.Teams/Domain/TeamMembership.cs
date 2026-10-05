using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// A user's membership in a team, with their <see cref="TeamRole"/> (arc42 ch. 8.1). At most one
/// non-deleted membership per user and team. Soft-deleted (ch. 8.16) when the member leaves or is
/// removed, or the team is deleted. A user who left or was removed gets a new membership when they
/// join again.
/// </summary>
internal sealed class TeamMembership : SoftDeletableEntity
{
    // For EF Core.
    private TeamMembership()
    {
    }

    public Guid Id { get; private set; }

    public Guid TeamId { get; private set; }

    public Guid UserId { get; private set; }

    public TeamRole Role { get; private set; }

    /// <summary>When the user became a member.</summary>
    public DateTimeOffset JoinedAt { get; private set; }

    /// <summary>The membership of the team's creator, who becomes its Admin (arc42 ch. 8.1).</summary>
    public static TeamMembership ForCreator(Guid id, Team team)
    {
        ArgumentNullException.ThrowIfNull(team);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        return new TeamMembership
        {
            Id = id,
            TeamId = team.Id,
            UserId = team.CreatedBy,
            Role = TeamRole.Admin,
            JoinedAt = team.CreatedAt,
        };
    }

    /// <summary>The membership of a user whose join request was accepted: they start as Reader (arc42 ch. 8.1).</summary>
    public static TeamMembership ForAcceptedRequest(Guid id, TeamJoinRequest request, DateTimeOffset at)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        if (request.Status != JoinRequestStatus.Accepted)
        {
            throw new InvalidOperationException("Only an accepted join request makes a member.");
        }

        return new TeamMembership
        {
            Id = id,
            TeamId = request.TeamId,
            UserId = request.UserId,
            Role = TeamRole.Reader,
            JoinedAt = at,
        };
    }

    /// <summary>Gives the member another role (whether the team keeps an Admin is <see cref="TeamRoster"/>'s rule).</summary>
    public void ChangeRole(TeamRole role)
    {
        if (!Enum.IsDefined(role))
        {
            throw new ArgumentOutOfRangeException(nameof(role), role, "Unknown team role.");
        }

        Role = role;
    }
}
