using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary><see cref="ITeamRepository"/> on the shared EF Core context.</summary>
internal sealed class EfTeamRepository(TacticalBoardDbContext context) : ITeamRepository
{
    private DbSet<Team> Teams => context.Set<Team>();

    private DbSet<TeamMembership> Memberships => context.Set<TeamMembership>();

    private DbSet<TeamLogo> Logos => context.Set<TeamLogo>();

    public Task<Team?> FindAsync(TeamKey key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        if (key.Id is { } id)
        {
            return Teams.SingleOrDefaultAsync(team => team.Id == id, cancellationToken);
        }

        var code = key.Code!.Value;
        return Teams.SingleOrDefaultAsync(team => team.Code == code, cancellationToken);
    }

    // A row lock (PostgreSQL syntax, kept inside the data-access layer, ADR-002). The condition on
    // deleted_at is part of the locking statement, so after waiting for a parallel deletion it is
    // checked again on the deleted row and the team is no longer found.
    public async Task<Team?> LockAsync(TeamKey key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        var query = key.Id is { } id
            ? Teams.FromSql($"SELECT * FROM teams WHERE id = {id} AND deleted_at IS NULL FOR UPDATE")
            : Teams.FromSql($"SELECT * FROM teams WHERE code = {key.Code!.Value} AND deleted_at IS NULL FOR UPDATE");
        return (await query.IgnoreQueryFilters([SoftDeleteQueryFilter.Name]).ToListAsync(cancellationToken)).SingleOrDefault();
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

            throw TeamUniqueIndexes.Translate(exception);
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
            throw TeamUniqueIndexes.Translate(exception);
        }
    }
}
