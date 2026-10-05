using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.Teams.Contracts;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// A user's membership in a team, with their <see cref="TeamRole"/> (arc42 ch. 8.1). At most one
/// non-deleted membership per user and team. Soft-deleted (ch. 8.16) when the member leaves or is
/// removed (roadmap Phase 2 step 7).
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
}
