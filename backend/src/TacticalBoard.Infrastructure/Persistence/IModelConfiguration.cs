using Microsoft.EntityFrameworkCore;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// Contributes a module's part of the EF Core model. All modules share one
/// <see cref="TacticalBoardDbContext"/>; each one brings its own entity configurations.
/// </summary>
public interface IModelConfiguration
{
    /// <summary>Adds the module's entities to <paramref name="modelBuilder"/>.</summary>
    void Configure(ModelBuilder modelBuilder);
}
