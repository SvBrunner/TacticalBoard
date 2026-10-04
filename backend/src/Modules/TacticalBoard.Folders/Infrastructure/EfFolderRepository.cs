using Microsoft.EntityFrameworkCore;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Application;
using TacticalBoard.Folders.Domain;
using TacticalBoard.Infrastructure.Persistence;

namespace TacticalBoard.Folders.Infrastructure;

/// <summary><see cref="IFolderRepository"/> on the shared EF Core context.</summary>
internal sealed class EfFolderRepository(TacticalBoardDbContext context) : IFolderRepository
{
    private DbSet<Folder> Folders => context.Set<Folder>();

    public Task<Folder?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        Folders.SingleOrDefaultAsync(folder => folder.Id == id, cancellationToken);

    // Row locks (PostgreSQL syntax, kept inside the data-access layer, ADR-002). The condition on
    // deleted_at is part of the locking statement, so after waiting for a parallel deletion it is
    // checked again on the deleted row and the folder is no longer found.
    public async Task<Folder?> LockForDeletionAsync(Guid id, CancellationToken cancellationToken) =>
        (await Folders
            .FromSql($"SELECT * FROM folders WHERE id = {id} AND deleted_at IS NULL FOR UPDATE")
            .IgnoreQueryFilters([SoftDeleteQueryFilter.Name])
            .ToListAsync(cancellationToken))
        .SingleOrDefault();

    public async Task<Folder?> LockAgainstDeletionAsync(Guid id, CancellationToken cancellationToken) =>
        (await Folders
            .FromSql($"SELECT * FROM folders WHERE id = {id} AND deleted_at IS NULL FOR SHARE")
            .IgnoreQueryFilters([SoftDeleteQueryFilter.Name])
            .AsNoTracking()
            .ToListAsync(cancellationToken))
        .SingleOrDefault();

    public async Task<IReadOnlyList<Folder>> ListAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return await InArea(Folders.AsNoTracking(), area).ToListAsync(cancellationToken);
    }

    public Task<bool> IsNameTakenAsync(AreaReference area, string normalizedName, Guid? exceptFolderId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        ArgumentNullException.ThrowIfNull(normalizedName);
        return InArea(Folders.AsNoTracking(), area)
            .Where(folder => folder.NormalizedName == normalizedName)
            .Where(folder => exceptFolderId == null || folder.Id != exceptFolderId)
            .AnyAsync(cancellationToken);
    }

    public async Task AddAsync(Folder folder, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(folder);
        Folders.Add(folder);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.UniqueViolationConstraint(exception) == FolderConfiguration.NameIndexName)
        {
            context.Entry(folder).State = EntityState.Detached;
            throw new FolderNameUniquenessViolationException("Another folder of the area has this name.", exception);
        }
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.UniqueViolationConstraint(exception) == FolderConfiguration.NameIndexName)
        {
            throw new FolderNameUniquenessViolationException("Another folder of the area has this name.", exception);
        }
    }

    private static IQueryable<Folder> InArea(IQueryable<Folder> folders, AreaReference area) =>
        folders.Where(folder => folder.AreaKind == area.Kind && folder.AreaOwnerId == area.OwnerId);
}
