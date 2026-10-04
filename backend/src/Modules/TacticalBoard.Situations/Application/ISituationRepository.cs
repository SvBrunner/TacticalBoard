using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.Situations.Application;

/// <summary>Stores <see cref="Situation"/>s and their <see cref="SituationRevision"/>s.</summary>
internal interface ISituationRepository
{
    /// <summary>The non-deleted situation with <paramref name="id"/>, tracked for changes.</summary>
    Task<Situation?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>The non-deleted situations of <paramref name="area"/> (read-only).</summary>
    Task<IReadOnlyList<Situation>> ListAsync(AreaReference area, CancellationToken cancellationToken);

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

    /// <summary>Saves the changes of tracked situations (e.g. a soft delete).</summary>
    /// <exception cref="ConcurrentRevisionException">Someone else saved a revision in the meantime.</exception>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
