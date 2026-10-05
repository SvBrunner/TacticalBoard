using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// A request names a team area of a team that doesn't exist (any more), or a malformed team key:
/// <c>404 team-not-found</c>, the same code as the Teams module's own routes (arc42 ch. 8.2).
/// </summary>
public sealed class TeamAreaNotFoundException(string? key)
    : DomainException(DomainErrorKind.NotFound, "team-not-found", "Team not found", $"There is no team {key}.");
