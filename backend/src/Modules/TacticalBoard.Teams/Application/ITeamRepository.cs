using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Application;

/// <summary>Stores <see cref="Team"/>s with their creator's membership and their logos.</summary>
internal interface ITeamRepository
{
    /// <summary>The non-deleted team named by <paramref name="key"/> (its code or id), tracked for changes.</summary>
    Task<Team?> FindAsync(TeamKey key, CancellationToken cancellationToken);

    /// <summary>
    /// The non-deleted team named by <paramref name="key"/>, tracked, and locked exclusively until the
    /// running transaction ends (needs one, <c>IUnitOfWork</c>): every change of the team's members,
    /// join requests or existence takes this lock first, so they run one after another and the
    /// "at least one Admin" rule holds under parallel requests (arc42 ch. 8.17). Waits for a running
    /// change; a team deleted meanwhile is not found.
    /// </summary>
    Task<Team?> LockAsync(TeamKey key, CancellationToken cancellationToken);

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

/// <summary>Stores <see cref="TeamMembership"/>s.</summary>
internal interface ITeamMembershipRepository
{
    /// <summary>The role of <paramref name="userId"/> in the non-deleted team <paramref name="teamId"/>, or <c>null</c> if no member (read fresh, not from tracked entities).</summary>
    Task<TeamRole?> FindRoleAsync(Guid teamId, Guid userId, CancellationToken cancellationToken);

    /// <summary>The non-deleted memberships of the team <paramref name="teamId"/>, tracked for changes.</summary>
    Task<IReadOnlyList<TeamMembership>> ListAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>Adds a new membership (saved with <see cref="SaveChangesAsync"/>).</summary>
    void Add(TeamMembership membership);

    /// <summary>Soft-deletes every non-deleted membership of the team <paramref name="teamId"/> at <paramref name="at"/> (written at once).</summary>
    Task DeleteAllOfTeamAsync(Guid teamId, DateTimeOffset at, CancellationToken cancellationToken);

    /// <summary>Saves added and changed memberships.</summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>Stores <see cref="TeamJoinRequest"/>s.</summary>
internal interface ITeamJoinRequestRepository
{
    /// <summary>Whether <paramref name="userId"/> has a pending (non-deleted) request for the team <paramref name="teamId"/>.</summary>
    Task<bool> HasPendingAsync(Guid teamId, Guid userId, CancellationToken cancellationToken);

    /// <summary>The pending (non-deleted) request <paramref name="requestId"/> of the team <paramref name="teamId"/>, tracked, or <c>null</c>.</summary>
    Task<TeamJoinRequest?> FindPendingAsync(Guid teamId, Guid requestId, CancellationToken cancellationToken);

    /// <summary>The pending (non-deleted) requests of the team <paramref name="teamId"/> (read-only), oldest first.</summary>
    Task<IReadOnlyList<TeamJoinRequest>> ListPendingAsync(Guid teamId, CancellationToken cancellationToken);

    /// <summary>The number of pending (non-deleted) requests per team of <paramref name="teamIds"/>, in one query; a team without any is missing.</summary>
    Task<IReadOnlyDictionary<Guid, int>> CountPendingAsync(IReadOnlyCollection<Guid> teamIds, CancellationToken cancellationToken);

    /// <summary>Adds a new request (saved with <see cref="SaveChangesAsync"/>).</summary>
    void Add(TeamJoinRequest request);

    /// <summary>Soft-deletes every pending request of the team <paramref name="teamId"/> at <paramref name="at"/> (written at once).</summary>
    Task DeletePendingOfTeamAsync(Guid teamId, DateTimeOffset at, CancellationToken cancellationToken);

    /// <summary>Saves added and changed requests.</summary>
    /// <exception cref="JoinRequestUniquenessViolationException">The user got a pending request for the team in the meantime.</exception>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>The database's unique index on pending join requests rejected a save (a parallel request was first).</summary>
internal sealed class JoinRequestUniquenessViolationException : Exception
{
    public JoinRequestUniquenessViolationException()
        : base("The user already has a pending join request for this team.")
    {
    }

    public JoinRequestUniquenessViolationException(string message)
        : base(message)
    {
    }

    public JoinRequestUniquenessViolationException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
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
