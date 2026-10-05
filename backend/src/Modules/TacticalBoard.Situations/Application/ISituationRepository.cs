using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Application;

/// <summary>Stores <see cref="Situation"/>s and their <see cref="SituationRevision"/>s.</summary>
internal interface ISituationRepository
{
    /// <summary>The non-deleted situation with <paramref name="id"/>, tracked for changes.</summary>
    Task<Situation?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// The non-deleted situations of <paramref name="area"/> in the folder <paramref name="folderId"/>,
    /// or at the top level for <c>null</c> (read-only).
    /// </summary>
    Task<IReadOnlyList<Situation>> ListAsync(AreaReference area, Guid? folderId, CancellationToken cancellationToken);

    /// <summary>Whether a non-deleted situation is in the folder <paramref name="folderId"/>.</summary>
    Task<bool> AnyInFolderAsync(Guid folderId, CancellationToken cancellationToken);

    /// <summary>
    /// The number of non-deleted situations of <paramref name="area"/> per folder (one grouped
    /// query); folders without situations and the top level are missing.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, int>> CountByFolderAsync(AreaReference area, CancellationToken cancellationToken);

    /// <summary>One revision of a situation (read-only).</summary>
    Task<SituationRevision?> FindRevisionAsync(Guid situationId, int number, CancellationToken cancellationToken);

    /// <summary>
    /// The normalized titles of the non-deleted situations of <paramref name="area"/> that start
    /// with <paramref name="normalizedPrefix"/> (so a title and its numbered variants), except
    /// <paramref name="exceptSituationId"/>.
    /// </summary>
    Task<IReadOnlySet<string>> FindTakenTitlesAsync(AreaReference area, string normalizedPrefix, Guid? exceptSituationId, CancellationToken cancellationToken);

    /// <summary>Adds and saves a new situation with its first revision.</summary>
    /// <exception cref="TitleUniquenessViolationException">Another situation of the area got the same title in the meantime.</exception>
    Task AddAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken);

    /// <summary>Saves the changes of a tracked situation together with its new revision.</summary>
    /// <exception cref="TitleUniquenessViolationException">Another situation of the area got the same title in the meantime.</exception>
    /// <exception cref="ConcurrentRevisionException">Someone else saved a revision in the meantime.</exception>
    Task SaveRevisionAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken);

    /// <summary>
    /// Writes only the folder of a tracked situation (a move, arc42 ch. 8.15). Deliberately without
    /// the revision check: a move doesn't conflict with a parallel save of the content.
    /// </summary>
    /// <returns><c>false</c> if the situation was deleted in the meantime.</returns>
    Task<bool> SaveFolderAsync(Situation situation, CancellationToken cancellationToken);

    /// <summary>
    /// Soft-deletes every non-deleted situation of <paramref name="area"/> at once (a bulk update with
    /// <paramref name="deletedAt"/>); their revisions stay, like for a single delete.
    /// </summary>
    Task DeleteAllInAreaAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken);

    /// <summary>Saves the changes of tracked situations (e.g. a soft delete).</summary>
    /// <exception cref="ConcurrentRevisionException">Someone else saved a revision in the meantime.</exception>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
