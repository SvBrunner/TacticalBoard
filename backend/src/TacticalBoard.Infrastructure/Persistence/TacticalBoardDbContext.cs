using Microsoft.EntityFrameworkCore;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// The single EF Core context of the backend. Its model is assembled from the
/// <see cref="IModelConfiguration"/>s the modules register; soft-delete filters are added last,
/// so they cover every module's entities.
/// </summary>
public class TacticalBoardDbContext : DbContext
{
    private readonly IReadOnlyList<IModelConfiguration> _modelConfigurations;

    public TacticalBoardDbContext(
        DbContextOptions<TacticalBoardDbContext> options,
        IEnumerable<IModelConfiguration> modelConfigurations)
        : this((DbContextOptions)options, modelConfigurations)
    {
    }

    /// <summary>For derived contexts (e.g. in tests) with their own options type.</summary>
    protected TacticalBoardDbContext(DbContextOptions options, IEnumerable<IModelConfiguration> modelConfigurations)
        : base(options)
    {
        ArgumentNullException.ThrowIfNull(modelConfigurations);
        _modelConfigurations = modelConfigurations.ToList();
        ModelCacheKey = string.Join(
            ';',
            _modelConfigurations.Select(configuration => configuration is AssemblyModelConfiguration assembly
                ? assembly.Assembly.FullName
                : configuration.GetType().AssemblyQualifiedName));
    }

    /// <summary>Identifies the set of model configurations, for <see cref="ModelConfigurationCacheKeyFactory"/>.</summary>
    public string ModelCacheKey { get; }

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        foreach (var configuration in _modelConfigurations)
        {
            configuration.Configure(modelBuilder);
        }

        SoftDeleteQueryFilter.ApplyTo(modelBuilder);
    }
}
