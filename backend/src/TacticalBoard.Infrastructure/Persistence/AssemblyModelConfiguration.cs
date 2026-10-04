using System.Reflection;
using Microsoft.EntityFrameworkCore;

namespace TacticalBoard.Infrastructure.Persistence;

/// <summary>
/// Applies every <see cref="IEntityTypeConfiguration{TEntity}"/> found in a module's assembly,
/// so a module adds an entity just by adding its configuration class.
/// </summary>
public sealed class AssemblyModelConfiguration(Assembly assembly) : IModelConfiguration
{
    /// <summary>The assembly whose configurations are applied.</summary>
    public Assembly Assembly { get; } = assembly;

    /// <inheritdoc />
    public void Configure(ModelBuilder modelBuilder)
    {
        ArgumentNullException.ThrowIfNull(modelBuilder);

        // A module without entities yet is fine; skipping it avoids EF Core's "no configurations found" warning.
        if (ContainsEntityTypeConfigurations())
        {
            modelBuilder.ApplyConfigurationsFromAssembly(Assembly);
        }
    }

    private bool ContainsEntityTypeConfigurations() =>
        Assembly.GetTypes().Any(type =>
            type is { IsAbstract: false, IsGenericTypeDefinition: false }
            && type.GetInterfaces().Any(contract =>
                contract.IsGenericType && contract.GetGenericTypeDefinition() == typeof(IEntityTypeConfiguration<>)));
}
