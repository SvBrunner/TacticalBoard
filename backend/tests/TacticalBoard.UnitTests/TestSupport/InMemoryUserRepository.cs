using TacticalBoard.Users.Application;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="IUserRepository"/> on a list, with counters to check how it is used.</summary>
internal sealed class InMemoryUserRepository : IUserRepository
{
    public List<User> Users { get; } = [];

    public int SaveCount { get; private set; }

    public int SessionQueries { get; private set; }

    /// <summary>When set, the next <see cref="AddAsync"/> fails as if a parallel login had added this user first.</summary>
    public User? ParallelWinner { get; set; }

    public Task<User?> FindByIdentityIncludingDeletedAsync(ExternalIdentity identity, CancellationToken cancellationToken) =>
        Task.FromResult(Users.SingleOrDefault(user => user.Identity == identity));

    public Task<User?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        Task.FromResult(Users.SingleOrDefault(user => user.Id == id && !user.IsDeleted));

    public Task<SessionUser?> FindSessionUserAsync(Guid id, CancellationToken cancellationToken)
    {
        SessionQueries++;
        var user = Users.SingleOrDefault(candidate => candidate.Id == id && !candidate.IsDeleted);
        return Task.FromResult(user is null
            ? null
            : new SessionUser(user.Id, user.DisplayName.Value, user.IsSystemAdministrator, user.IsBlocked));
    }

    public Task<bool> AnyActiveSystemAdministratorAsync(CancellationToken cancellationToken) =>
        Task.FromResult(Users.Any(user => user.IsSystemAdministrator && !user.IsBlocked && !user.IsDeleted));

    public Task AddAsync(User user, CancellationToken cancellationToken)
    {
        if (ParallelWinner is not null)
        {
            Users.Add(ParallelWinner);
            ParallelWinner = null;
            throw new DuplicateUserIdentityException();
        }

        if (Users.Any(existing => existing.Identity == user.Identity))
        {
            throw new DuplicateUserIdentityException();
        }

        Users.Add(user);
        SaveCount++;
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        SaveCount++;
        return Task.CompletedTask;
    }
}

/// <summary>An <see cref="TacticalBoard.SharedKernel.Identifiers.IIdGenerator"/> returning predictable ids.</summary>
internal sealed class SequenceIdGenerator : TacticalBoard.SharedKernel.Identifiers.IIdGenerator
{
    private int _next = 1;

    public Guid NewId() => new($"00000000-0000-0000-0000-{_next++:D12}");
}

/// <summary>Factory for users in tests.</summary>
internal static class TestUsers
{
    public const string Issuer = "https://idp.example.org";

    public static ExternalIdentity Identity(string subject = "alice") => new(Issuer, subject);

    public static User Create(string subject = "alice", string name = "Alice", Guid? id = null) =>
        User.Register(id ?? Guid.NewGuid(), Identity(subject), DisplayName.FromIdentityProvider(name, null, null), DateTimeOffset.UnixEpoch);
}
