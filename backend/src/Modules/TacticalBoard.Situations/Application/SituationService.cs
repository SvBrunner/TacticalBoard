using TacticalBoard.Areas.Contracts;
using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Application;

/// <summary>
/// The use cases of saved situations (arc42 ch. 8.15): list, open, save (create or update with
/// conflict detection, title uniqueness and default titles) and delete. Access is decided by the
/// Areas module: a situation in an area the user can't read is "not found"; one they can read but
/// not write is "forbidden".
/// </summary>
internal sealed class SituationService(
    ISituationRepository situations,
    IAreaAccess areas,
    IActorDirectory actors,
    IIdGenerator ids,
    IClock clock)
{
    /// <summary>How often a first save retries after a parallel save took the numbered title it chose.</summary>
    public const int TitleAttempts = 3;

    /// <summary>
    /// The situations of <paramref name="area"/>, most recently changed first (then by title).
    /// </summary>
    /// <exception cref="SituationAccessDeniedException">The user may not read the area.</exception>
    public async Task<IReadOnlyList<SituationSummaryView>> ListAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        if (!await areas.CanReadAsync(area, cancellationToken))
        {
            throw new SituationAccessDeniedException();
        }

        var found = (await situations.ListAsync(area, cancellationToken))
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

    /// <summary>The first save of a situation: creates it in <paramref name="area"/> (at the top level) with revision 1.</summary>
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

        var numbered = origin != SituationOrigin.New || title.IsDefault;
        for (var attempt = 1; ; attempt++)
        {
            var finalTitle = await ChooseTitleAsync(area, title, numbered, exceptSituationId: null, cancellationToken);
            var (situation, revision) = Situation.Create(ids.NewId(), area, finalTitle, document, SaveTime(), actors.CurrentUserId);
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
        var taken = await situations.FindTakenTitlesAsync(area, title.Normalized, exceptSituationId, cancellationToken);
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
