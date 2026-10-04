using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Users;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class AssemblyModelConfigurationTests
{
    [Fact]
    public void Applies_every_entity_configuration_of_the_assembly()
    {
        var modelBuilder = new ModelBuilder();

        new AssemblyModelConfiguration(typeof(Note).Assembly).Configure(modelBuilder);

        var entityTypes = modelBuilder.Model.GetEntityTypes().Select(type => type.ClrType).ToList();
        Assert.Contains(typeof(Note), entityTypes);
        Assert.Contains(typeof(PinnedNote), entityTypes);
        Assert.Contains(typeof(Tag), entityTypes);
    }

    [Fact]
    public void Adds_nothing_for_an_assembly_without_configurations()
    {
        var modelBuilder = new ModelBuilder();

        new AssemblyModelConfiguration(typeof(UsersModule).Assembly).Configure(modelBuilder);

        Assert.Empty(modelBuilder.Model.GetEntityTypes());
    }

    [Fact]
    public void Exposes_its_assembly()
    {
        var assembly = typeof(Note).Assembly;

        Assert.Same(assembly, new AssemblyModelConfiguration(assembly).Assembly);
    }

    [Fact]
    public void Rejects_a_missing_model_builder() =>
        Assert.Throws<ArgumentNullException>(() => new AssemblyModelConfiguration(typeof(Note).Assembly).Configure(null!));
}
