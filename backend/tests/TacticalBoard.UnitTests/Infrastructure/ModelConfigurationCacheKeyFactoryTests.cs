using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class ModelConfigurationCacheKeyFactoryTests
{
    private static readonly ModelConfigurationCacheKeyFactory Factory = new();

    [Fact]
    public void Same_configurations_share_a_key()
    {
        using var first = TestDbContext.Create(new AssemblyModelConfiguration(typeof(Note).Assembly));
        using var second = TestDbContext.Create(new AssemblyModelConfiguration(typeof(Note).Assembly));

        Assert.Equal(Factory.Create(first, designTime: false), Factory.Create(second, designTime: false));
    }

    [Fact]
    public void Different_configurations_get_different_keys()
    {
        using var withNotes = TestDbContext.Create(new AssemblyModelConfiguration(typeof(Note).Assembly));
        using var withoutNotes = TestDbContext.Create(new AssemblyModelConfiguration(typeof(TacticalBoard.Teams.TeamsModule).Assembly));

        Assert.NotEqual(Factory.Create(withNotes, designTime: false), Factory.Create(withoutNotes, designTime: false));
        Assert.NotEqual(withNotes.ModelCacheKey, withoutNotes.ModelCacheKey);
    }

    [Fact]
    public void Design_time_gets_its_own_key()
    {
        using var context = TestDbContext.Create();

        Assert.NotEqual(Factory.Create(context, designTime: false), Factory.Create(context, designTime: true));
    }

    [Fact]
    public void Identifies_other_configurations_by_type()
    {
        using var context = TestDbContext.Create(new RecordingModelConfiguration("a", []));

        Assert.Contains(nameof(RecordingModelConfiguration), context.ModelCacheKey, StringComparison.Ordinal);
    }

    [Fact]
    public void Works_for_other_contexts()
    {
        using var context = new DbContext(new DbContextOptionsBuilder().UseInMemoryDatabase("other").Options);

        Assert.Equal((typeof(DbContext), string.Empty, false), Factory.Create(context, designTime: false));
    }
}
