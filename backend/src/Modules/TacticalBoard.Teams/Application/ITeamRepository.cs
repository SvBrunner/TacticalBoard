using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Application;

/// <summary>Stores <see cref="Team"/>s with their creator's membership and their logos.</summary>
internal interface ITeamRepository
{
    /// <summary>The non-deleted team with <paramref name="code"/>, tracked for changes.</summary>
    Task<Team?> FindByCodeAsync(TeamCode code, CancellationToken cancellationToken);

    /// <summary>
    /// One page of the non-deleted teams whose normalized name contains <paramref name="nameFragment"/>
    /// or whose code contains <paramref name="codeFragment"/> (both <c>null</c>: all), ordered by the
    /// normalized name, then the code; with the number of all matches.
    /// </summary>
    Task<(IReadOnlyList<Team> Teams, int Total)> SearchAsync(string? nameFragment, string? codeFragment, int offset, int limit, CancellationToken cancellationToken);

    /// <summary>The non-deleted teams <paramref name="userId"/> is a member of, with their role (read-only).</summary>
    Task<IReadOnlyList<(Team Team, TeamRole Role)>> ListOfMemberAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Whether a non-deleted team other than <paramref name="exceptTeamId"/> has the normalized name.</summary>
    Task<bool> IsNameTakenAsync(string normalizedName, Guid? exceptTeamId, CancellationToken cancellationToken);

    /// <summary>Whether any team, also a deleted one, has <paramref name="code"/> (codes are never reused).</summary>
    Task<bool> IsCodeTakenAsync(TeamCode code, CancellationToken cancellationToken);

    /// <summary>Adds and saves a new team with its creator's membership and, optionally, its logo, all at once.</summary>
    /// <exception cref="TeamNameUniquenessViolationException">Another team got the same name in the meantime.</exception>
    /// <exception cref="TeamCodeUniquenessViolationException">Another team got the same code in the meantime.</exception>
    Task AddAsync(Team team, TeamMembership creator, TeamLogo? logo, CancellationToken cancellationToken);

    /// <summary>The logo of the team <paramref name="teamId"/> (read-only), or <c>null</c>.</summary>
    Task<TeamLogo?> FindLogoAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>Stores <paramref name="logo"/> as its team's logo, replacing an existing one (written at once).</summary>
    Task SaveLogoAsync(TeamLogo logo, CancellationToken cancellationToken);

    /// <summary>Removes the logo of the team <paramref name="teamId"/>, if any (written at once).</summary>
    Task DeleteLogoAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>Saves the changes of tracked teams (a rename, a logo change).</summary>
    /// <exception cref="TeamNameUniquenessViolationException">Another team got the same name in the meantime.</exception>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>Looks up memberships.</summary>
internal interface ITeamMembershipRepository
{
    /// <summary>The role of <paramref name="userId"/> in the non-deleted team <paramref name="teamId"/>, or <c>null</c> if no member.</summary>
    Task<TeamRole?> FindRoleAsync(Guid teamId, Guid userId, CancellationToken cancellationToken);
}

/// <summary>The database's unique name index rejected a save (a parallel save took the name first).</summary>
internal sealed class TeamNameUniquenessViolationException : Exception
{
    public TeamNameUniquenessViolationException()
        : base("Another team has this name.")
    {
    }

    public TeamNameUniquenessViolationException(string message)
        : base(message)
    {
    }

    public TeamNameUniquenessViolationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

/// <summary>The database's unique code index rejected a new team (a parallel save took the code first).</summary>
internal sealed class TeamCodeUniquenessViolationException : Exception
{
    public TeamCodeUniquenessViolationException()
        : base("Another team has this code.")
    {
    }

    public TeamCodeUniquenessViolationException(string message)
        : base(message)
    {
    }

    public TeamCodeUniquenessViolationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
