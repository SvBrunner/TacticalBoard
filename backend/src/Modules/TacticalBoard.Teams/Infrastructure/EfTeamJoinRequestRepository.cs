using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary><see cref="ITeamJoinRequestRepository"/> on the shared EF Core context.</summary>
internal sealed class EfTeamJoinRequestRepository(TacticalBoardDbContext context) : ITeamJoinRequestRepository
{
    private DbSet<TeamJoinRequest> Requests => context.Set<TeamJoinRequest>();

    private IQueryable<TeamJoinRequest> Pending => Requests.Where(request => request.Status == JoinRequestStatus.Pending);

    public Task<bool> HasPendingAsync(Guid teamId, Guid userId, CancellationToken cancellationToken) =>
        Pending.AsNoTracking().AnyAsync(request => request.TeamId == teamId && request.UserId == userId, cancellationToken);

    public Task<TeamJoinRequest?> FindPendingAsync(Guid teamId, Guid requestId, CancellationToken cancellationToken) =>
        Pending.SingleOrDefaultAsync(request => request.TeamId == teamId && request.Id == requestId, cancellationToken);

    public async Task<IReadOnlyList<TeamJoinRequest>> ListPendingAsync(Guid teamId, CancellationToken cancellationToken) =>
        await Pending.AsNoTracking()
            .Where(request => request.TeamId == teamId)
            .OrderBy(request => request.RequestedAt)
            .ThenBy(request => request.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<Guid, int>> CountPendingAsync(IReadOnlyCollection<Guid> teamIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(teamIds);
        if (teamIds.Count == 0)
        {
            return new Dictionary<Guid, int>();
        }

        var ids = teamIds.Distinct().ToList();
        return await Pending.AsNoTracking()
            .Where(request => ids.Contains(request.TeamId))
            .GroupBy(request => request.TeamId)
            .Select(group => new { TeamId = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.TeamId, row => row.Count, cancellationToken);
    }

    public void Add(TeamJoinRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        Requests.Add(request);
    }

    public async Task DeletePendingOfTeamAsync(Guid teamId, DateTimeOffset at, CancellationToken cancellationToken) =>
        await Pending
            .Where(request => request.TeamId == teamId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(request => request.DeletedAt, at), cancellationToken);

    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await TeamUniqueIndexes.SaveChangesAsync(context, cancellationToken);
        }
        catch (JoinRequestUniquenessViolationException)
        {
            // The rejected request stays out of the context, so a later save doesn't repeat it.
            foreach (var entry in context.ChangeTracker.Entries<TeamJoinRequest>().Where(entry => entry.State == EntityState.Added).ToList())
            {
                entry.State = EntityState.Detached;
            }

            throw;
        }
    }
}
