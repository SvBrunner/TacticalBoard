using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>Recognizes database errors without spreading provider (PostgreSQL) specifics into the modules (ADR-002).</summary>
public static class DatabaseErrors
{
    /// <summary>Whether <paramref name="exception"/> was caused by a unique constraint or index.</summary>
    public static bool IsUniqueViolation(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);
        return exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
    }
}
