using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Users.Application;
using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Infrastructure;

/// <summary><see cref="IUserRepository"/> on the shared EF Core context.</summary>
internal sealed class EfUserRepository(TacticalBoardDbContext context) : IUserRepository
{
    private DbSet<User> Users => context.Set<User>();

    public Task<User?> FindByIdentityAsync(ExternalIdentity identity, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identity);
        return Users.SingleOrDefaultAsync(user => user.Issuer == identity.Issuer && user.Subject == identity.Subject, cancellationToken);
    }

    public Task<bool> AnyAccountIncludingDeletedAsync(ExternalIdentity identity, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(identity);
        return Users
            .IgnoreQueryFilters([SoftDeleteQueryFilter.Name])
            .AnyAsync(user => user.Issuer == identity.Issuer && user.Subject == identity.Subject, cancellationToken);
    }

    public Task<User?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        Users.SingleOrDefaultAsync(user => user.Id == id, cancellationToken);

    public Task<SessionUser?> FindSessionUserAsync(Guid id, CancellationToken cancellationToken) =>
        Users
            .AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new SessionUser(user.Id, user.DisplayNameValue, user.IsSystemAdministrator, user.IsBlocked))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ids);
        return await Users
            .AsNoTracking()
            .Where(user => ids.Contains(user.Id))
            .ToDictionaryAsync(user => user.Id, user => user.DisplayNameValue, cancellationToken);
    }

    public Task<bool> AnyActiveSystemAdministratorAsync(CancellationToken cancellationToken) =>
        Users.AnyAsync(user => user.IsSystemAdministrator && !user.IsBlocked, cancellationToken);

    public async Task AddAsync(User user, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);
        Users.Add(user);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.IsUniqueViolation(exception))
        {
            context.Entry(user).State = EntityState.Detached;
            throw new DuplicateUserIdentityException("A user with this identity exists already.", exception);
        }
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) => context.SaveChangesAsync(cancellationToken);
}
