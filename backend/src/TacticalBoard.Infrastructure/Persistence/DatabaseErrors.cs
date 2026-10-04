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

    /// <summary>
    /// The name of the unique constraint or index that caused <paramref name="exception"/>, or
    /// <c>null</c> if it was no unique violation (or the database didn't say which).
    /// </summary>
    public static string? UniqueViolationConstraint(DbUpdateException exception)
    {
        ArgumentNullException.ThrowIfNull(exception);
        return exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } postgres
            ? postgres.ConstraintName
            : null;
    }
}
