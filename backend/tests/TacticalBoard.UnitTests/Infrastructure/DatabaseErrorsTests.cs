using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;

namespace TacticalBoard.UnitTests.Infrastructure;

/// <summary>The unique-violation detection on a real PostgreSQL error is covered by the integration tests.</summary>
public class DatabaseErrorsTests
{
    [Fact]
    public void Other_errors_are_no_unique_violation()
    {
        Assert.False(DatabaseErrors.IsUniqueViolation(new DbUpdateException("x")));
        Assert.False(DatabaseErrors.IsUniqueViolation(new DbUpdateException("x", new InvalidOperationException())));
    }

    [Fact]
    public void Requires_an_exception() => Assert.Throws<ArgumentNullException>(() => DatabaseErrors.IsUniqueViolation(null!));
}
