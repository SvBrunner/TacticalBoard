using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary><see cref="ITeamRepository"/> and <see cref="ITeamMembershipRepository"/> on the shared EF Core context.</summary>
internal sealed class EfTeamRepository(TacticalBoardDbContext context) : ITeamRepository, ITeamMembershipRepository
{
    private DbSet<Team> Teams => context.Set<Team>();

    private DbSet<TeamMembership> Memberships => context.Set<TeamMembership>();

    private DbSet<TeamLogo> Logos => context.Set<TeamLogo>();

    public Task<Team?> FindByCodeAsync(TeamCode code, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(code);
        return Teams.SingleOrDefaultAsync(team => team.Code == code.Value, cancellationToken);
    }

    public async Task<(IReadOnlyList<Team> Teams, int Total)> SearchAsync(
        string? nameFragment,
        string? codeFragment,
        int offset,
        int limit,
        CancellationToken cancellationToken)
    {
        var query = Teams.AsNoTracking();
        if (nameFragment is not null || codeFragment is not null)
        {
            // string.Contains is translated without LIKE wildcards, so "%" or "_" in the search match literally.
            query = query.Where(team =>
                (nameFragment != null && team.NormalizedName.Contains(nameFragment))
                || (codeFragment != null && team.Code.Contains(codeFragment)));
        }

        var total = await query.CountAsync(cancellationToken);
        var page = await query
            .OrderBy(team => team.NormalizedName)
            .ThenBy(team => team.Code)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);
        return (page, total);
    }

    public async Task<IReadOnlyList<(Team Team, TeamRole Role)>> ListOfMemberAsync(Guid userId, CancellationToken cancellationToken)
    {
        var rows = await Memberships.AsNoTracking()
            .Where(membership => membership.UserId == userId)
            .Join(Teams.AsNoTracking(), membership => membership.TeamId, team => team.Id, (membership, team) => new { Team = team, membership.Role })
            .ToListAsync(cancellationToken);
        return rows.Select(row => (row.Team, row.Role)).ToList();
    }

    public async Task<TeamRole?> FindRoleAsync(Guid teamId, Guid userId, CancellationToken cancellationToken)
    {
        var roles = await Memberships.AsNoTracking()
            .Where(membership => membership.TeamId == teamId && membership.UserId == userId)
            .Join(Teams.AsNoTracking(), membership => membership.TeamId, team => team.Id, (membership, _) => membership.Role)
            .ToListAsync(cancellationToken);
        return roles.Count == 0 ? null : roles[0];
    }

    public Task<bool> IsNameTakenAsync(string normalizedName, Guid? exceptTeamId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(normalizedName);
        return Teams.AsNoTracking()
            .Where(team => team.NormalizedName == normalizedName)
            .Where(team => exceptTeamId == null || team.Id != exceptTeamId)
            .AnyAsync(cancellationToken);
    }

    public Task<bool> IsCodeTakenAsync(TeamCode code, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(code);
        return Teams.AsNoTracking().IgnoreQueryFilters([SoftDeleteQueryFilter.Name]).AnyAsync(team => team.Code == code.Value, cancellationToken);
    }

    public async Task AddAsync(Team team, TeamMembership creator, TeamLogo? logo, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(team);
        ArgumentNullException.ThrowIfNull(creator);
        Teams.Add(team);
        Memberships.Add(creator);
        if (logo is not null)
        {
            Logos.Add(logo);
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.IsUniqueViolation(exception))
        {
            context.Entry(team).State = EntityState.Detached;
            context.Entry(creator).State = EntityState.Detached;
            if (logo is not null)
            {
                context.Entry(logo).State = EntityState.Detached;
            }

            throw Translate(exception);
        }
    }

    public Task<TeamLogo?> FindLogoAsync(Guid teamId, CancellationToken cancellationToken) =>
        Logos.AsNoTracking().SingleOrDefaultAsync(logo => logo.TeamId == teamId, cancellationToken);

    // An upsert (PostgreSQL syntax, kept inside the data-access layer, ADR-002): parallel uploads
    // for the same team end with the last one instead of a key conflict.
    public async Task SaveLogoAsync(TeamLogo logo, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(logo);
        await context.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO team_logos (team_id, content, content_type, hash, updated_at, updated_by)
            VALUES ({logo.TeamId}, {logo.Content}, {logo.ContentType}, {logo.Hash}, {logo.UpdatedAt}, {logo.UpdatedBy})
            ON CONFLICT (team_id) DO UPDATE SET
                content = EXCLUDED.content,
                content_type = EXCLUDED.content_type,
                hash = EXCLUDED.hash,
                updated_at = EXCLUDED.updated_at,
                updated_by = EXCLUDED.updated_by
            """,
            cancellationToken);
    }

    public async Task DeleteLogoAsync(Guid teamId, CancellationToken cancellationToken) =>
        await Logos.Where(logo => logo.TeamId == teamId).ExecuteDeleteAsync(cancellationToken);

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.IsUniqueViolation(exception))
        {
            throw Translate(exception);
        }
    }

    private static Exception Translate(DbUpdateException exception) => DatabaseErrors.UniqueViolationConstraint(exception) switch
    {
        TeamConfiguration.NameIndexName => new TeamNameUniquenessViolationException("Another team has this name.", exception),
        TeamConfiguration.CodeIndexName => new TeamCodeUniquenessViolationException("Another team has this code.", exception),
        _ => exception,
    };
}
