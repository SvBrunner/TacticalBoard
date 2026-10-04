using TacticalBoard.Areas.Contracts;
using TacticalBoard.Folders.Contracts;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Persistence;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Application;

/// <summary>
/// The use cases of saved situations (arc42 ch. 8.15): list (top level or a folder), open, save
/// (create or update with conflict detection, title uniqueness and default titles), move between
/// the folders of the area, and delete. Access is decided by the Areas module: a situation or
/// folder in an area the user can't read is "not found"; one they can read but not write is
/// "forbidden". Folders are looked up through the Folders module (<see cref="IFolderDirectory"/>).
/// </summary>
internal sealed class SituationService(
    ISituationRepository situations,
    IFolderDirectory folders,
    IAreaAccess areas,
    IActorDirectory actors,
    IUnitOfWork transactions,
    IIdGenerator ids,
    IClock clock)
{
    /// <summary>How often a first save retries after a parallel save took the numbered title it chose.</summary>
    public const int TitleAttempts = 3;

    /// <summary>
    /// The situations at the top level of <paramref name="area"/> (in no folder), most recently
    /// changed first (then by title).
    /// </summary>
    /// <exception cref="SituationAccessDeniedException">The user may not read the area.</exception>
    public async Task<IReadOnlyList<SituationSummaryView>> ListAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        if (!await areas.CanReadAsync(area, cancellationToken))
        {
            throw new SituationAccessDeniedException();
        }

        return await ListPlaceAsync(area, folderId: null, cancellationToken);
    }

    /// <summary>The situations in the folder <paramref name="folderId"/>, in the same order as <see cref="ListAsync(AreaReference, CancellationToken)"/>.</summary>
    /// <exception cref="FolderNotFoundException">The folder doesn't exist or the user may not read its area.</exception>
    public async Task<IReadOnlyList<SituationSummaryView>> ListInFolderAsync(Guid folderId, CancellationToken cancellationToken)
    {
        var folder = await FindReadableFolderAsync(folderId, cancellationToken);
        return await ListPlaceAsync(folder.Area, folder.Id, cancellationToken);
    }

    private async Task<IReadOnlyList<SituationSummaryView>> ListPlaceAsync(AreaReference area, Guid? folderId, CancellationToken cancellationToken)
    {
        var found = (await situations.ListAsync(area, folderId, cancellationToken))
            .OrderByDescending(situation => situation.UpdatedAt)
            .ThenBy(situation => situation.NormalizedTitle, StringComparer.Ordinal)
            .ToList();
        var names = await NamesAsync(found, cancellationToken);
        return found.Select(situation => Summary(situation, names)).ToList();
    }

    /// <summary>The situation with its current document.</summary>
    /// <exception cref="SituationNotFoundException">It doesn't exist or the user may not read its area.</exception>
    public async Task<SituationView> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var situation = await FindReadableAsync(id, cancellationToken);
        return await ViewAsync(situation, cancellationToken);
    }

    /// <summary>The first save of a situation: creates it at the top level of <paramref name="area"/> with revision 1.</summary>
    /// <exception cref="SituationAccessDeniedException">The user may not write in the area.</exception>
    /// <exception cref="DuplicateSituationTitleException">The title is taken (only for <see cref="SituationOrigin.New"/> with a non-default title).</exception>
    public async Task<SituationView> CreateAsync(
        AreaReference area,
        SituationTitle title,
        SituationDocument document,
        SituationOrigin origin,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(document);
        if (!await areas.CanWriteAsync(area, cancellationToken))
        {
            throw new SituationAccessDeniedException();
        }

        return await CreatePlacedAsync(area, folderId: null, title, document, origin, cancellationToken);
    }

    /// <summary>
    /// The first save of a situation started in a folder (ch. 8.15: saved where it was started):
    /// creates it in the folder <paramref name="folderId"/>, in the folder's area. Titles are unique
    /// in the whole area, not per folder.
    /// </summary>
    /// <exception cref="FolderNotFoundException">The folder doesn't exist or the user may not read its area.</exception>
    /// <exception cref="SituationAccessDeniedException">The user may not write in the folder's area.</exception>
    /// <exception cref="DuplicateSituationTitleException">The title is taken (as for <see cref="CreateAsync(AreaReference, SituationTitle, SituationDocument, SituationOrigin, CancellationToken)"/>).</exception>
    public async Task<SituationView> CreateInFolderAsync(
        Guid folderId,
        SituationTitle title,
        SituationDocument document,
        SituationOrigin origin,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(document);
        var folder = await FindReadableFolderAsync(folderId, cancellationToken);
        if (!await areas.CanWriteAsync(folder.Area, cancellationToken))
        {
            throw new SituationAccessDeniedException();
        }

        // The folder must not be deleted between the check and the save (ch. 8.15).
        return await transactions.InTransactionAsync(
            async cancellation =>
            {
                _ = await folders.FindForPlacingAsync(folder.Id, cancellation) ?? throw new FolderNotFoundException(folderId);
                return await CreatePlacedAsync(folder.Area, folder.Id, title, document, origin, cancellation);
            },
            cancellationToken);
    }

    private async Task<SituationView> CreatePlacedAsync(
        AreaReference area,
        Guid? folderId,
        SituationTitle title,
        SituationDocument document,
        SituationOrigin origin,
        CancellationToken cancellationToken)
    {
        var numbered = origin != SituationOrigin.New || title.IsDefault;
        for (var attempt = 1; ; attempt++)
        {
            var finalTitle = await ChooseTitleAsync(area, title, numbered, exceptSituationId: null, cancellationToken);
            var (situation, revision) = Situation.Create(ids.NewId(), area, folderId, finalTitle, document, SaveTime(), actors.CurrentUserId);
            try
            {
                await situations.AddAsync(situation, revision, cancellationToken);
                return await ViewAsync(situation, revision, cancellationToken);
            }
            catch (TitleUniquenessViolationException) when (numbered && attempt < TitleAttempts)
            {
                // A parallel save took the chosen number; choose again.
            }
            catch (TitleUniquenessViolationException)
            {
                throw new DuplicateSituationTitleException(finalTitle.Value);
            }
        }
    }

    /// <summary>A later save: the next revision, if the client's revision is still the current one.</summary>
    /// <exception cref="SituationNotFoundException">It doesn't exist or the user may not read its area.</exception>
    /// <exception cref="SituationAccessDeniedException">The user may not write in its area.</exception>
    /// <exception cref="SituationSaveConflictException">Someone else saved since <paramref name="expectedRevision"/>.</exception>
    /// <exception cref="SituationPropertyChangedException">The sport or field type would change.</exception>
    /// <exception cref="DuplicateSituationTitleException">Another situation of the area has the title.</exception>
    public async Task<SituationView> UpdateAsync(
        Guid id,
        int expectedRevision,
        SituationTitle title,
        SituationDocument document,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(title);
        ArgumentNullException.ThrowIfNull(document);
        var situation = await FindWritableAsync(id, cancellationToken);
        if (situation.CurrentRevision != expectedRevision)
        {
            throw new SituationSaveConflictException(situation.CurrentRevision);
        }

        await ChooseTitleAsync(situation.Area, title, numbered: false, situation.Id, cancellationToken);
        var revision = situation.Revise(title, document, SaveTime(), actors.CurrentUserId);
        try
        {
            await situations.SaveRevisionAsync(situation, revision, cancellationToken);
        }
        catch (TitleUniquenessViolationException)
        {
            throw new DuplicateSituationTitleException(title.Value);
        }
        catch (ConcurrentRevisionException exception)
        {
            throw new SituationSaveConflictException(exception.CurrentRevision);
        }

        return await ViewAsync(situation, revision, cancellationToken);
    }

    /// <summary>
    /// Moves the situation into the folder <paramref name="folderId"/> of its area, or to the top
    /// level (<c>null</c>). Not into another area (ch. 1). A metadata change (ch. 8.15): no new
    /// revision, the revision number (ETag) and "last changed" stay, and no <c>If-Match</c> is
    /// needed, because a move doesn't conflict with saving the content.
    /// </summary>
    /// <returns>The situation's metadata after the move.</returns>
    /// <exception cref="SituationNotFoundException">It doesn't exist or the user may not read its area.</exception>
    /// <exception cref="SituationAccessDeniedException">The user may not write in its area.</exception>
    /// <exception cref="FolderNotFoundException">The target folder doesn't exist or lies in another area.</exception>
    public async Task<SituationSummaryView> MoveAsync(Guid id, Guid? folderId, CancellationToken cancellationToken)
    {
        var situation = await FindWritableAsync(id, cancellationToken);
        await transactions.InTransactionAsync(
            async cancellation =>
            {
                // The target folder must not be deleted between the check and the move (ch. 8.15).
                if (folderId is { } target)
                {
                    var folder = await folders.FindForPlacingAsync(target, cancellation);
                    if (folder is null || folder.Area != situation.Area)
                    {
                        throw new FolderNotFoundException(target);
                    }
                }

                situation.MoveTo(folderId);
                return await situations.SaveFolderAsync(situation, cancellation)
                    ? true
                    : throw new SituationNotFoundException(id);
            },
            cancellationToken);

        var names = await NamesAsync([situation], cancellationToken);
        return Summary(situation, names);
    }

    /// <summary>Soft-deletes the situation (with its revisions); its title becomes free again.</summary>
    /// <exception cref="SituationNotFoundException">It doesn't exist or the user may not read its area.</exception>
    /// <exception cref="SituationAccessDeniedException">The user may not write in its area.</exception>
    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var situation = await FindWritableAsync(id, cancellationToken);
        situation.MarkDeleted(clock.UtcNow);
        try
        {
            await situations.SaveChangesAsync(cancellationToken);
        }
        catch (ConcurrentRevisionException exception)
        {
            throw new SituationSaveConflictException(exception.CurrentRevision);
        }
    }

    private async Task<FolderReference> FindReadableFolderAsync(Guid folderId, CancellationToken cancellationToken)
    {
        var folder = await folders.FindAsync(folderId, cancellationToken);
        if (folder is null || !await areas.CanReadAsync(folder.Area, cancellationToken))
        {
            throw new FolderNotFoundException(folderId);
        }

        return folder;
    }

    private async Task<Situation> FindReadableAsync(Guid id, CancellationToken cancellationToken)
    {
        var situation = await situations.FindAsync(id, cancellationToken);
        if (situation is null || !await areas.CanReadAsync(situation.Area, cancellationToken))
        {
            throw new SituationNotFoundException(id);
        }

        return situation;
    }

    private async Task<Situation> FindWritableAsync(Guid id, CancellationToken cancellationToken)
    {
        var situation = await FindReadableAsync(id, cancellationToken);
        if (!await areas.CanWriteAsync(situation.Area, cancellationToken))
        {
            throw new SituationAccessDeniedException();
        }

        return situation;
    }

    /// <summary>The title to save: <paramref name="title"/> if free; otherwise the next free number, or an error.</summary>
    private async Task<SituationTitle> ChooseTitleAsync(
        AreaReference area,
        SituationTitle title,
        bool numbered,
        Guid? exceptSituationId,
        CancellationToken cancellationToken)
    {
        // The numbered variants share the base of the title ("Powerplay (2)" → "Powerplay (3)").
        var taken = await situations.FindTakenTitlesAsync(area, title.NumberingStart.Base.Normalized, exceptSituationId, cancellationToken);
        if (numbered)
        {
            return title.FirstFree(taken);
        }

        if (taken.Contains(title.Normalized))
        {
            throw new DuplicateSituationTitleException(title.Value);
        }

        return title;
    }

    /// <summary>Now, cut to milliseconds: the precision of the document's timestamps, so row and document agree.</summary>
    private DateTimeOffset SaveTime()
    {
        var now = clock.UtcNow;
        return now.AddTicks(-(now.Ticks % TimeSpan.TicksPerMillisecond));
    }

    private async Task<SituationView> ViewAsync(Situation situation, CancellationToken cancellationToken)
    {
        var revision = await situations.FindRevisionAsync(situation.Id, situation.CurrentRevision, cancellationToken)
            ?? throw new InvalidOperationException($"Situation {situation.Id} has no revision {situation.CurrentRevision}.");
        return await ViewAsync(situation, revision, cancellationToken);
    }

    private async Task<SituationView> ViewAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken)
    {
        var names = await NamesAsync([situation], cancellationToken);
        return new SituationView(Summary(situation, names), revision.Document);
    }

    private Task<IReadOnlyDictionary<Guid, string>> NamesAsync(IReadOnlyCollection<Situation> found, CancellationToken cancellationToken) =>
        actors.FindDisplayNamesAsync(
            found.SelectMany(situation => new[] { situation.CreatedBy, situation.UpdatedBy }).Distinct().ToList(),
            cancellationToken);

    private static SituationSummaryView Summary(Situation situation, IReadOnlyDictionary<Guid, string> names) =>
        new(
            situation.Id,
            situation.Title,
            situation.Sport,
            situation.FieldType,
            situation.FolderId,
            situation.CurrentRevision,
            situation.CreatedAt,
            User(situation.CreatedBy, names),
            situation.UpdatedAt,
            User(situation.UpdatedBy, names));

    private static UserReferenceView User(Guid id, IReadOnlyDictionary<Guid, string> names) =>
        new(id, names.TryGetValue(id, out var name) ? name : null);
}
