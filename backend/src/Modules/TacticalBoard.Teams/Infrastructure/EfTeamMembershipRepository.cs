using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Contracts;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary><see cref="ITeamMembershipRepository"/> on the shared EF Core context.</summary>
internal sealed class EfTeamMembershipRepository(TacticalBoardDbContext context) : ITeamMembershipRepository
{
    private DbSet<TeamMembership> Memberships => context.Set<TeamMembership>();

    private DbSet<Team> Teams => context.Set<Team>();

    public async Task<TeamRole?> FindRoleAsync(Guid teamId, Guid userId, CancellationToken cancellationToken)
    {
        var roles = await Memberships.AsNoTracking()
            .Where(membership => membership.TeamId == teamId && membership.UserId == userId)
            .Join(Teams.AsNoTracking(), membership => membership.TeamId, team => team.Id, (membership, _) => membership.Role)
            .ToListAsync(cancellationToken);
        return roles.Count == 0 ? null : roles[0];
    }

    public async Task<IReadOnlyList<TeamMembership>> ListAsync(Guid teamId, CancellationToken cancellationToken) =>
        await Memberships.Where(membership => membership.TeamId == teamId).ToListAsync(cancellationToken);

    public void Add(TeamMembership membership)
    {
        ArgumentNullException.ThrowIfNull(membership);
        Memberships.Add(membership);
    }

    public async Task DeleteAllOfTeamAsync(Guid teamId, DateTimeOffset at, CancellationToken cancellationToken) =>
        await Memberships
            .Where(membership => membership.TeamId == teamId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(membership => membership.DeletedAt, at), cancellationToken);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => TeamUniqueIndexes.SaveChangesAsync(context, cancellationToken);
}
