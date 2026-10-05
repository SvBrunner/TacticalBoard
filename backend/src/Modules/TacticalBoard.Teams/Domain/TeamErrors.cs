using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Teams.Domain;

/// <summary>There is no (non-deleted) team with this code or id.</summary>
internal sealed class TeamNotFoundException(string key)
    : DomainException(DomainErrorKind.NotFound, "team-not-found", "Team not found", $"There is no team {key}.");

/// <summary>The team has no logo.</summary>
internal sealed class TeamLogoNotFoundException(string code)
    : DomainException(DomainErrorKind.NotFound, "team-logo-not-found", "Team logo not found", $"The team {code} has no logo.");

/// <summary>The current user may not do this in the team (e.g. rename it without being its Admin, or see its members without being one).</summary>
internal sealed class TeamAccessDeniedException(string detail = "Only the team's Admins may change its name and logo.")
    : DomainException(DomainErrorKind.Forbidden, "forbidden", "Forbidden", detail);

/// <summary>Another non-deleted team has this name (ignoring case and surrounding whitespace).</summary>
internal sealed class DuplicateTeamNameException(string name)
    : DomainException(DomainErrorKind.Conflict, "duplicate-team-name", "Duplicate team name", $"A team named \"{name}\" already exists.")
{
    /// <inheritdoc />
    public override IReadOnlyDictionary<string, object?> Details { get; } = new Dictionary<string, object?> { ["existingName"] = name };
}

/// <summary>The change would leave the team without an Admin (arc42 ch. 1, 8.1): the last Admin can't leave, be removed or lose the role.</summary>
internal sealed class LastTeamAdminException()
    : DomainException(DomainErrorKind.Conflict, "last-team-admin", "Last team Admin", "A team needs at least one Admin. Make another member Admin first, or delete the team.");

/// <summary>The user is not a member of the team.</summary>
internal sealed class TeamMemberNotFoundException(Guid userId)
    : DomainException(DomainErrorKind.NotFound, "team-member-not-found", "Team member not found", $"The user {userId} is not a member of this team.");

/// <summary>There is no pending join request with this id in the team (it may have been decided already).</summary>
internal sealed class JoinRequestNotFoundException(Guid requestId)
    : DomainException(DomainErrorKind.NotFound, "join-request-not-found", "Join request not found", $"There is no pending join request {requestId} in this team.");

/// <summary>The current user is already a member of the team, so they can't ask to join it.</summary>
internal sealed class AlreadyTeamMemberException()
    : DomainException(DomainErrorKind.Conflict, "already-team-member", "Already a member", "You are already a member of this team.");

/// <summary>The current user already has a pending join request for the team (one at a time; it can't be withdrawn).</summary>
internal sealed class JoinRequestPendingException()
    : DomainException(DomainErrorKind.Conflict, "join-request-pending", "Join request pending", "You have already asked to join this team; an Admin will accept or reject your request.");
