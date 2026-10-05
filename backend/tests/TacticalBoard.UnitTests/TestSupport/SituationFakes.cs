using TacticalBoard.Areas.Contracts;
using TacticalBoard.Situations.Application;
using TacticalBoard.Situations.Domain;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="IAreaAccess"/> with explicit grants.</summary>
internal sealed class FakeAreaAccess(Guid currentUser) : IAreaAccess
{
    public HashSet<AreaReference> Readable { get; } = [AreaReference.Personal(currentUser)];

    public HashSet<AreaReference> Writable { get; } = [AreaReference.Personal(currentUser)];

    public AreaReference CurrentUsersPersonalArea() => AreaReference.Personal(currentUser);

    public Task<bool> CanReadAsync(AreaReference area, CancellationToken cancellationToken) => Task.FromResult(Readable.Contains(area));

    public Task<bool> CanWriteAsync(AreaReference area, CancellationToken cancellationToken) => Task.FromResult(Writable.Contains(area));
}

/// <summary>An <see cref="IAreaDirectory"/> on a dictionary of team keys (code or id) to team ids.</summary>
internal sealed class FakeAreaDirectory : IAreaDirectory
{
    public Dictionary<string, Guid> Teams { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Adds a team known by <paramref name="code"/> and by its id; returns its area.</summary>
    public AreaReference AddTeam(string code, Guid? id = null)
    {
        var teamId = id ?? Guid.NewGuid();
        Teams[code] = teamId;
        Teams[teamId.ToString()] = teamId;
        return new AreaReference(AreaKind.Team, teamId);
    }

    public Task<AreaReference> TeamAreaAsync(string? teamKey, CancellationToken cancellationToken) =>
        teamKey is not null && Teams.TryGetValue(teamKey, out var id)
            ? Task.FromResult(new AreaReference(AreaKind.Team, id))
            : throw new TeamAreaNotFoundException(teamKey);
}

/// <summary>An <see cref="IActorDirectory"/> on a dictionary.</summary>
internal sealed class FakeActorDirectory(Guid currentUser) : IActorDirectory
{
    public Guid CurrentUserId { get; set; } = currentUser;

    public Dictionary<Guid, string> Names { get; } = [];

    public Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        IReadOnlyDictionary<Guid, string> found = Names.Where(entry => userIds.Contains(entry.Key)).ToDictionary();
        return Task.FromResult(found);
    }
}

/// <summary>
/// An <see cref="ISituationRepository"/> on lists. Enforces the unique title like the database,
/// and can simulate parallel saves.
/// </summary>
internal sealed class InMemorySituationRepository : ISituationRepository
{
    public List<Situation> Situations { get; } = [];

    public List<SituationRevision> Revisions { get; } = [];

    public int SaveCount { get; private set; }

    /// <summary>Titles a "parallel save" takes right before the next adds (one per add).</summary>
    public Queue<string> TitlesTakenInParallel { get; } = new();

    /// <summary>When set, the next save of a revision fails as if someone saved this revision in parallel.</summary>
    public int? ParallelRevision { get; set; }

    /// <summary>When set, the next save of a revision fails as if a parallel save took the title.</summary>
    public bool TitleTakenOnNextRevision { get; set; }

    private readonly HashSet<string> _parallelTitles = new(StringComparer.Ordinal);

    public Task<Situation?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Situations.SingleOrDefault(situation => situation.Id == id && !situation.IsDeleted));

    /// <summary>When set, the next folder save finds the situation deleted (a parallel delete).</summary>
    public bool DeletedBeforeFolderSave { get; set; }

    /// <summary>The folder saves (situation id, folder id).</summary>
    public List<(Guid SituationId, Guid? FolderId)> FolderSaves { get; } = [];

    public Task<IReadOnlyList<Situation>> ListAsync(AreaReference area, Guid? folderId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Situation>>(
            Situations.Where(situation => situation.Area == area && situation.FolderId == folderId && !situation.IsDeleted).ToList());

    public Task<bool> AnyInFolderAsync(Guid folderId, CancellationToken cancellationToken) =>
        Task.FromResult(Situations.Any(situation => situation.FolderId == folderId && !situation.IsDeleted));

    public Task<IReadOnlyDictionary<Guid, int>> CountByFolderAsync(AreaReference area, CancellationToken cancellationToken)
    {
        IReadOnlyDictionary<Guid, int> counts = Situations
            .Where(situation => situation.Area == area && situation.FolderId != null && !situation.IsDeleted)
            .GroupBy(situation => situation.FolderId!.Value)
            .ToDictionary(group => group.Key, group => group.Count());
        return Task.FromResult(counts);
    }

    public Task DeleteAllInAreaAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken)
    {
        foreach (var situation in Situations.Where(situation => situation.Area == area && !situation.IsDeleted))
        {
            situation.MarkDeleted(deletedAt);
        }

        return Task.CompletedTask;
    }

    public Task<bool> SaveFolderAsync(Situation situation, CancellationToken cancellationToken)
    {
        if (DeletedBeforeFolderSave)
        {
            DeletedBeforeFolderSave = false;
            return Task.FromResult(false);
        }

        FolderSaves.Add((situation.Id, situation.FolderId));
        return Task.FromResult(true);
    }

    public Task<SituationRevision?> FindRevisionAsync(Guid situationId, int number, CancellationToken cancellationToken) =>
        Task.FromResult(Revisions.SingleOrDefault(revision => revision.SituationId == situationId && revision.Number == number));

    public Task<IReadOnlySet<string>> FindTakenTitlesAsync(AreaReference area, string normalizedPrefix, Guid? exceptSituationId, CancellationToken cancellationToken)
    {
        IReadOnlySet<string> titles = Situations
            .Where(situation => situation.Area == area && !situation.IsDeleted && situation.Id != exceptSituationId)
            .Select(situation => situation.NormalizedTitle)
            .Concat(_parallelTitles)
            .Where(title => title.StartsWith(normalizedPrefix, StringComparison.Ordinal))
            .ToHashSet(StringComparer.Ordinal);
        return Task.FromResult(titles);
    }

    public Task AddAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken)
    {
        if (TitlesTakenInParallel.TryDequeue(out var parallel))
        {
            _parallelTitles.Add(SituationTitle.Normalize(parallel));
        }

        if (_parallelTitles.Contains(situation.NormalizedTitle) || IsTitleTaken(situation))
        {
            throw new TitleUniquenessViolationException();
        }

        Situations.Add(situation);
        Revisions.Add(revision);
        SaveCount++;
        return Task.CompletedTask;
    }

    public Task SaveRevisionAsync(Situation situation, SituationRevision revision, CancellationToken cancellationToken)
    {
        if (ParallelRevision is { } current)
        {
            ParallelRevision = null;
            throw new ConcurrentRevisionException(current);
        }

        if (TitleTakenOnNextRevision || IsTitleTaken(situation))
        {
            TitleTakenOnNextRevision = false;
            throw new TitleUniquenessViolationException();
        }

        Revisions.Add(revision);
        SaveCount++;
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        if (ParallelRevision is { } current)
        {
            ParallelRevision = null;
            throw new ConcurrentRevisionException(current);
        }

        SaveCount++;
        return Task.CompletedTask;
    }

    private bool IsTitleTaken(Situation situation) =>
        Situations.Any(other => other.Id != situation.Id && other.Area == situation.Area && !other.IsDeleted && other.NormalizedTitle == situation.NormalizedTitle);
}
