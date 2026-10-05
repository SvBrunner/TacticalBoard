using System.Globalization;
using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.Folders.Domain;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.Folders.Application;

/// <summary>
/// The use cases of folders (arc42 ch. 8.15): list (with the number of situations in each), get,
/// create, rename and delete the flat folders of an area. Names are unique per area; a folder can
/// only be deleted while it is empty (asked through <see cref="IFolderContents"/>, implemented by
/// Situations, which also counts the situations). Access is decided by
/// the Areas module: a folder in an area the user can't read is "not found"; one they can read but
/// not write is "forbidden".
/// </summary>
internal sealed class FolderService(
    IFolderRepository folders,
    IFolderContents contents,
    IAreaAccess areas,
    IActorDirectory actors,
    IUnitOfWork transactions,
    IIdGenerator ids,
    IClock clock)
{
    /// <summary>
    /// The folders of <paramref name="area"/>, by name (ignoring case, then exactly), each with the
    /// number of non-deleted situations in it (one query for all folders, asked through
    /// <see cref="IFolderContents"/>).
    /// </summary>
    /// <exception cref="FolderAccessDeniedException">The user may not read the area.</exception>
    public async Task<IReadOnlyList<FolderSummary>> ListAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        if (!await areas.CanReadAsync(area, cancellationToken))
        {
            throw new FolderAccessDeniedException();
        }

        var list = await folders.ListAsync(area, cancellationToken);
        var counts = await contents.CountSituationsByFolderAsync(area, cancellationToken);
        var canWrite = await areas.CanWriteAsync(area, cancellationToken);
        return list
            .OrderBy(folder => folder.Name, StringComparer.Create(CultureInfo.InvariantCulture, CompareOptions.IgnoreCase))
            .ThenBy(folder => folder.Name, StringComparer.Ordinal)
            .Select(folder => new FolderSummary(View(folder, canWrite), counts.GetValueOrDefault(folder.Id)))
            .ToList();
    }

    /// <summary>The folder with <paramref name="id"/>.</summary>
    /// <exception cref="FolderNotFoundException">It doesn't exist or the user may not read its area.</exception>
    public async Task<FolderView> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var folder = await FindReadableAsync(id, cancellationToken);
        return View(folder, await areas.CanWriteAsync(folder.Area, cancellationToken));
    }

    /// <summary>Creates a folder in <paramref name="area"/>.</summary>
    /// <exception cref="FolderAccessDeniedException">The user may not write in the area.</exception>
    /// <exception cref="DuplicateFolderNameException">The name is taken in the area.</exception>
    public async Task<FolderView> CreateAsync(AreaReference area, FolderName name, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        ArgumentNullException.ThrowIfNull(name);
        if (!await areas.CanWriteAsync(area, cancellationToken))
        {
            throw new FolderAccessDeniedException();
        }

        await EnsureNameIsFreeAsync(area, name, exceptFolderId: null, cancellationToken);
        var folder = Folder.Create(ids.NewId(), area, name, clock.UtcNow, actors.CurrentUserId);
        try
        {
            await folders.AddAsync(folder, cancellationToken);
        }
        catch (FolderNameUniquenessViolationException)
        {
            throw new DuplicateFolderNameException(name.Value);
        }

        return View(folder, canWrite: true);
    }

    /// <summary>Renames the folder; its own name (e.g. in another case) is no conflict.</summary>
    /// <exception cref="FolderNotFoundException">It doesn't exist or the user may not read its area.</exception>
    /// <exception cref="FolderAccessDeniedException">The user may not write in its area.</exception>
    /// <exception cref="DuplicateFolderNameException">Another folder of the area has the name.</exception>
    public async Task<FolderView> RenameAsync(Guid id, FolderName name, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(name);
        var folder = await FindWritableAsync(id, cancellationToken);
        await EnsureNameIsFreeAsync(folder.Area, name, folder.Id, cancellationToken);
        folder.Rename(name, clock.UtcNow, actors.CurrentUserId);
        try
        {
            await folders.SaveChangesAsync(cancellationToken);
        }
        catch (FolderNameUniquenessViolationException)
        {
            throw new DuplicateFolderNameException(name.Value);
        }

        return View(folder, canWrite: true);
    }

    /// <summary>
    /// Soft-deletes the folder if it contains no situations; its name becomes free again. The check
    /// and the deletion run in one transaction with the folder locked, so a parallel move into the
    /// folder (or a first save in it) either comes first and blocks the deletion, or waits and then
    /// finds no folder.
    /// </summary>
    /// <exception cref="FolderNotFoundException">It doesn't exist or the user may not read its area.</exception>
    /// <exception cref="FolderAccessDeniedException">The user may not write in its area.</exception>
    /// <exception cref="FolderNotEmptyException">It still contains situations.</exception>
    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        await FindWritableAsync(id, cancellationToken);
        await transactions.InTransactionAsync(
            async cancellation =>
            {
                var folder = await folders.LockForDeletionAsync(id, cancellation) ?? throw new FolderNotFoundException(id);
                if (await contents.HasSituationsAsync(folder.Id, cancellation))
                {
                    throw new FolderNotEmptyException(folder.Name);
                }

                folder.MarkDeleted(clock.UtcNow);
                await folders.SaveChangesAsync(cancellation);
                return true;
            },
            cancellationToken);
    }

    private async Task<Folder> FindReadableAsync(Guid id, CancellationToken cancellationToken)
    {
        var folder = await folders.FindAsync(id, cancellationToken);
        if (folder is null || !await areas.CanReadAsync(folder.Area, cancellationToken))
        {
            throw new FolderNotFoundException(id);
        }

        return folder;
    }

    private async Task<Folder> FindWritableAsync(Guid id, CancellationToken cancellationToken)
    {
        var folder = await FindReadableAsync(id, cancellationToken);
        if (!await areas.CanWriteAsync(folder.Area, cancellationToken))
        {
            throw new FolderAccessDeniedException();
        }

        return folder;
    }

    private async Task EnsureNameIsFreeAsync(AreaReference area, FolderName name, Guid? exceptFolderId, CancellationToken cancellationToken)
    {
        if (await folders.IsNameTakenAsync(area, name.Normalized, exceptFolderId, cancellationToken))
        {
            throw new DuplicateFolderNameException(name.Value);
        }
    }

    private static FolderView View(Folder folder, bool canWrite) =>
        new(folder.Id, folder.Name, folder.CreatedAt, folder.UpdatedAt, folder.Area, canWrite);
}
