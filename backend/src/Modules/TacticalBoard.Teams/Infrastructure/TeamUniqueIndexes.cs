using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Teams.Application;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>Turns a unique-index violation of the Teams tables into the repository exception the services handle.</summary>
internal static class TeamUniqueIndexes
{
    /// <summary>The repository exception for <paramref name="exception"/>, or the exception itself for any other index.</summary>
    public static Exception Translate(DbUpdateException exception) => DatabaseErrors.UniqueViolationConstraint(exception) switch
    {
        TeamConfiguration.NameIndexName => new TeamNameUniquenessViolationException("Another team has this name.", exception),
        TeamConfiguration.CodeIndexName => new TeamCodeUniquenessViolationException("Another team has this code.", exception),
        TeamJoinRequestConfiguration.PendingIndexName => new JoinRequestUniquenessViolationException("The user already has a pending join request for this team.", exception),
        _ => exception,
    };

    /// <summary>Saves the context, translating a violated unique index of the Teams tables.</summary>
    public static async Task SaveChangesAsync(TacticalBoardDbContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (DatabaseErrors.IsUniqueViolation(exception))
        {
            throw Translate(exception);
        }
    }
}
