using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Application;

/// <summary>Stores <see cref="User"/>s.</summary>
internal interface IUserRepository
{
    /// <summary>The user mapped from <paramref name="identity"/>, deleted ones included, tracked for changes.</summary>
    Task<User?> FindByIdentityIncludingDeletedAsync(ExternalIdentity identity, CancellationToken cancellationToken);

    /// <summary>The non-deleted user with <paramref name="id"/>, tracked for changes.</summary>
    Task<User?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>A read-only snapshot of the non-deleted user with <paramref name="id"/> (one cheap query; for every request).</summary>
    Task<SessionUser?> FindSessionUserAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Whether a system administrator exists who is neither blocked nor deleted.</summary>
    Task<bool> AnyActiveSystemAdministratorAsync(CancellationToken cancellationToken);

    /// <summary>Adds and saves a new user.</summary>
    /// <exception cref="DuplicateUserIdentityException">A user with the same identity exists already (e.g. a parallel first login).</exception>
    Task AddAsync(User user, CancellationToken cancellationToken);

    /// <summary>Saves the changes to tracked users.</summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
