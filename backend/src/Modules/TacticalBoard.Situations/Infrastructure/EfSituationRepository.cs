using Microsoft.EntityFrameworkCore;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Infrastructure;

/// <summary><see cref="ISituationRepository"/> on the shared EF Core context.</summary>
internal sealed class EfSituationRepository(TacticalBoardDbContext context) : ISituationRepository
{
    private DbSet<Situation> Situations => context.Set<Situation>();

    private DbSet<SituationRevision> Revisions => context.Set<SituationRevision>();

    public Task<Situation?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        Situations.SingleOrDefaultAsync(situation => situation.Id == id, cancellationToken);

    public async Task<IReadOnlyList<Situation>> ListAsync(AreaReference area, Guid? folderId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return await InArea(Situations.AsNoTracking(), area)
            .Where(situation => situation.FolderId == folderId)
            .ToListAsync(cancellationToken);
    }

    public Task<bool> AnyInFolderAsync(Guid folderId, CancellationToken cancellationToken) =>
        Situations.AsNoTracking().AnyAsync(situation => situation.FolderId == folderId, cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> CountByFolderAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);

        // One query: SELECT folder_id, count(*) ... WHERE <area> AND folder_id IS NOT NULL AND deleted_at IS NULL GROUP BY folder_id.
        var counts = await InArea(Situations.AsNoTracking(), area)
            .Where(situation => situation.FolderId != null)
            .GroupBy(situation => situation.FolderId!.Value)
            .Select(group => new { FolderId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken);
        return counts.ToDictionary(entry => entry.FolderId, entry => entry.Count);
    }

    public Task<SituationRevision?> FindRevisionAsync(Guid situationId, int number, CancellationToken cancellationToken) =>
        Revisions.AsNoTracking().SingleOrDefaultAsync(revision => revision.SituationId == situationId && revision.Number == number, cancellationToken);

    public async Task<IReadOnlySet<string>> FindTakenTitlesAsync(
        AreaReference area,
        string normalizedPrefix,
        Guid? exceptSituationId,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        ArgumentNullException.ThrowIfNull(normalizedPrefix);
        var titles = await InArea(Situations.AsNoTracking(), area)
            .Where(situation => situation.NormalizedTitle.StartsWith(normalizedPrefix))
            .Where(situation => exceptSituationId == null || situation.Id != exceptSituationId)
            .Select(situation => situation.NormalizedTitle)
            .ToListAsync(cancellationToken);
        return titles.ToHashSet(StringComparer.Ordinal);
    }

    public async Task AddAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(situation);
        ArgumentNullException.ThrowIfNull(revision);
        Situations.Add(situation);
        Revisions.Add(revision);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.UniqueViolationConstraint(exception) == SituationConfiguration.TitleIndexName)
        {
            context.Entry(revision).State = EntityState.Detached;
            context.Entry(situation).State = EntityState.Detached;
            throw new TitleUniquenessViolationException("Another situation of the area has this title.", exception);
        }
    }

    public async Task SaveRevisionAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(situation);
        ArgumentNullException.ThrowIfNull(revision);
        Revisions.Add(revision);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception)
        {
            context.Entry(revision).State = EntityState.Detached;
            var constraint = DatabaseErrors.UniqueViolationConstraint(exception);
            if (constraint == SituationConfiguration.TitleIndexName)
            {
                throw new TitleUniquenessViolationException("Another situation of the area has this title.", exception);
            }

            if (exception is DbUpdateConcurrencyException || constraint == SituationRevisionConfiguration.PrimaryKeyName)
            {
                throw new ConcurrentRevisionException(await CurrentRevisionAsync(situation.Id, cancellationToken), exception);
            }

            throw;
        }
    }

    public async Task<bool> SaveFolderAsync(Situation situation, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(situation);
        var folderId = situation.FolderId;
        var updated = await Situations
            .Where(stored => stored.Id == situation.Id)
            .ExecuteUpdateAsync(setters => setters.SetProperty(stored => stored.FolderId, folderId), cancellationToken);

        // The tracked entity now matches the row again; a later SaveChanges must not write it once more.
        context.Entry(situation).Property(stored => stored.FolderId).OriginalValue = folderId;
        context.Entry(situation).Property(stored => stored.FolderId).IsModified = false;
        return updated == 1;
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            var situation = exception.Entries.Select(entry => entry.Entity).OfType<Situation>().FirstOrDefault();
            var current = situation is null ? 0 : await CurrentRevisionAsync(situation.Id, cancellationToken);
            throw new ConcurrentRevisionException(current, exception);
        }
    }

    private static IQueryable<Situation> InArea(IQueryable<Situation> situations, AreaReference area) =>
        situations.Where(situation => situation.AreaKind == area.Kind && situation.AreaOwnerId == area.OwnerId);

    /// <summary>The newest revision as stored now (bypassing the tracked, stale entity), deleted situations included.</summary>
    private Task<int> CurrentRevisionAsync(Guid id, CancellationToken cancellationToken) =>
        Situations
            .AsNoTracking()
            .IgnoreQueryFilters([SoftDeleteQueryFilter.Name])
            .Where(situation => situation.Id == id)
            .Select(situation => situation.CurrentRevision)
            .SingleOrDefaultAsync(cancellationToken);
}
