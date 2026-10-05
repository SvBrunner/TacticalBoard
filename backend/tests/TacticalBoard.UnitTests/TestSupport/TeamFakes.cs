using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="ITeamCodeGenerator"/> that hands out given codes in order.</summary>
internal sealed class SequenceTeamCodeGenerator(params string[] codes) : ITeamCodeGenerator
{
    private readonly Queue<string> _codes = new(codes);

    public int Generated { get; private set; }

    public void Add(params string[] codes)
    {
        foreach (var code in codes)
        {
            _codes.Enqueue(code);
        }
    }

    public TeamCode NewCode()
    {
        Generated++;
        return TeamCode.Parse(_codes.Dequeue());
    }
}

/// <summary>
/// <see cref="ITeamRepository"/> and <see cref="ITeamMembershipRepository"/> on lists. Enforces the
/// unique name and code like the database and can simulate parallel saves taking them.
/// </summary>
internal sealed class InMemoryTeamRepository(FakeUnitOfWork? transactions = null) : ITeamRepository, ITeamMembershipRepository
{
    public List<Team> Teams { get; } = [];

    public List<TeamMembership> Memberships { get; } = [];

    public Dictionary<Guid, TeamLogo> Logos { get; } = [];

    public int SaveCount { get; private set; }

    /// <summary>The logo writes (team id, whether a transaction was running).</summary>
    public List<(Guid TeamId, bool InTransaction)> LogoWrites { get; } = [];

    /// <summary>When set, the next add or save fails as if a parallel save took the name.</summary>
    public bool NameTakenInParallel { get; set; }

    /// <summary>How many of the next adds fail as if a parallel save took their code.</summary>
    public int CodesTakenInParallel { get; set; }

    /// <summary>The searches made (name fragment, code fragment, offset, limit).</summary>
    public List<(string? Name, string? Code, int Offset, int Limit)> Searches { get; } = [];

    public Task<Team?> FindByCodeAsync(TeamCode code, CancellationToken cancellationToken) =>
        Task.FromResult(Teams.SingleOrDefault(team => team.Code == code.Value && !team.IsDeleted));

    public Task<(IReadOnlyList<Team> Teams, int Total)> SearchAsync(string? nameFragment, string? codeFragment, int offset, int limit, CancellationToken cancellationToken)
    {
        Searches.Add((nameFragment, codeFragment, offset, limit));
        var matches = Teams
            .Where(team => !team.IsDeleted)
            .Where(team => (nameFragment is null && codeFragment is null)
                || (nameFragment is not null && team.NormalizedName.Contains(nameFragment, StringComparison.Ordinal))
                || (codeFragment is not null && team.Code.Contains(codeFragment, StringComparison.Ordinal)))
            .OrderBy(team => team.NormalizedName, StringComparer.Ordinal)
            .ThenBy(team => team.Code, StringComparer.Ordinal)
            .ToList();
        return Task.FromResult<(IReadOnlyList<Team>, int)>((matches.Skip(offset).Take(limit).ToList(), matches.Count));
    }

    public Task<IReadOnlyList<(Team Team, TeamRole Role)>> ListOfMemberAsync(Guid userId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<(Team, TeamRole)>>(
            Memberships
                .Where(membership => membership.UserId == userId && !membership.IsDeleted)
                .Select(membership => (Team: Teams.Single(team => team.Id == membership.TeamId), membership.Role))
                .Where(entry => !entry.Team.IsDeleted)
                .ToList());

    public Task<TeamRole?> FindRoleAsync(Guid teamId, Guid userId, CancellationToken cancellationToken) =>
        Task.FromResult(
            Memberships
                .Where(membership => membership.TeamId == teamId && membership.UserId == userId && !membership.IsDeleted)
                .Where(membership => Teams.Any(team => team.Id == teamId && !team.IsDeleted))
                .Select(membership => (TeamRole?)membership.Role)
                .SingleOrDefault());

    public Task<bool> IsNameTakenAsync(string normalizedName, Guid? exceptTeamId, CancellationToken cancellationToken) =>
        Task.FromResult(Teams.Any(team => !team.IsDeleted && team.Id != exceptTeamId && team.NormalizedName == normalizedName));

    public Task<bool> IsCodeTakenAsync(TeamCode code, CancellationToken cancellationToken) =>
        Task.FromResult(Teams.Any(team => team.Code == code.Value));

    public Task AddAsync(Team team, TeamMembership creator, TeamLogo? logo, CancellationToken cancellationToken)
    {
        if (CodesTakenInParallel > 0)
        {
            CodesTakenInParallel--;
            throw new TeamCodeUniquenessViolationException();
        }

        ThrowIfNameTaken(team);
        Teams.Add(team);
        Memberships.Add(creator);
        if (logo is not null)
        {
            Logos[logo.TeamId] = logo;
        }

        SaveCount++;
        return Task.CompletedTask;
    }

    public Task<TeamLogo?> FindLogoAsync(Guid teamId, CancellationToken cancellationToken) =>
        Task.FromResult(Logos.GetValueOrDefault(teamId));

    public Task SaveLogoAsync(TeamLogo logo, CancellationToken cancellationToken)
    {
        LogoWrites.Add((logo.TeamId, transactions?.InTransaction ?? false));
        Logos[logo.TeamId] = logo;
        return Task.CompletedTask;
    }

    public Task DeleteLogoAsync(Guid teamId, CancellationToken cancellationToken)
    {
        LogoWrites.Add((teamId, transactions?.InTransaction ?? false));
        Logos.Remove(teamId);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        foreach (var team in Teams.Where(team => !team.IsDeleted))
        {
            ThrowIfNameTaken(team);
        }

        SaveCount++;
        return Task.CompletedTask;
    }

    /// <summary>Adds a membership of <paramref name="userId"/> with <paramref name="role"/> (memberships come with step 7).</summary>
    public void AddMember(Team team, Guid userId, TeamRole role) =>
        Memberships.Add(TestTeams.Membership(team, userId, role));

    private void ThrowIfNameTaken(Team team)
    {
        if (NameTakenInParallel)
        {
            NameTakenInParallel = false;
            throw new TeamNameUniquenessViolationException();
        }

        if (Teams.Any(other => other.Id != team.Id && !other.IsDeleted && other.NormalizedName == team.NormalizedName))
        {
            throw new TeamNameUniquenessViolationException();
        }
    }
}

/// <summary>Factories for teams in tests.</summary>
internal static class TestTeams
{
    public static readonly DateTimeOffset Now = new(2026, 10, 4, 8, 0, 0, TimeSpan.Zero);

    public static TeamName Name(string text) =>
        TeamName.TryCreate(text, out var name, out var error) ? name : throw new ArgumentException(error.Message, nameof(text));

    public static Team Team(string name = "Lions", string code = "ABC123", Guid? creator = null, Guid? id = null) =>
        TacticalBoard.Teams.Domain.Team.Create(id ?? Guid.NewGuid(), Name(name), TeamCode.Parse(code), Now, creator ?? Guid.NewGuid());

    /// <summary>A membership with any role (built through the creator's membership and EF Core's private setter).</summary>
    public static TeamMembership Membership(Team team, Guid userId, TeamRole role)
    {
        var membership = TeamMembership.ForCreator(Guid.NewGuid(), team);
        typeof(TeamMembership).GetProperty(nameof(TeamMembership.UserId))!.SetValue(membership, userId);
        typeof(TeamMembership).GetProperty(nameof(TeamMembership.Role))!.SetValue(membership, role);
        return membership;
    }

    public static TeamLogoImage Logo(byte seed = 1, int width = 10, int height = 10) =>
        TeamLogoImage.Create([seed, 2, 3, 4], "image/png", width, height);
}
