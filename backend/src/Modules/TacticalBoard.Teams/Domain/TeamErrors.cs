using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Teams.Domain;

/// <summary>There is no (non-deleted) team with this code.</summary>
internal sealed class TeamNotFoundException(string code)
    : DomainException(DomainErrorKind.NotFound, "team-not-found", "Team not found", $"There is no team with the code {code}.");

/// <summary>The team has no logo.</summary>
internal sealed class TeamLogoNotFoundException(string code)
    : DomainException(DomainErrorKind.NotFound, "team-logo-not-found", "Team logo not found", $"The team {code} has no logo.");

/// <summary>The current user may not do this in the team (e.g. rename it without being its Admin).</summary>
internal sealed class TeamAccessDeniedException()
    : DomainException(DomainErrorKind.Forbidden, "forbidden", "Forbidden", "Only the team's Admins may change its name and logo.");

/// <summary>Another non-deleted team has this name (ignoring case and surrounding whitespace).</summary>
internal sealed class DuplicateTeamNameException(string name)
    : DomainException(DomainErrorKind.Conflict, "duplicate-team-name", "Duplicate team name", $"A team named \"{name}\" already exists.")
{
    /// <inheritdoc />
    public override IReadOnlyDictionary<string, object?> Details { get; } = new Dictionary<string, object?> { ["existingName"] = name };
}
