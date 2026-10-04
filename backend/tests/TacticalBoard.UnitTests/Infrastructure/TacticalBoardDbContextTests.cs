using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class TacticalBoardDbContextTests
{
    [Fact]
    public void Applies_every_model_configuration_in_order()
    {
        var log = new List<string>();
        using var context = TestDbContext.Create(
            new RecordingModelConfiguration("first", log),
            new RecordingModelConfiguration("second", log));

        _ = context.Model;

        Assert.Equal(["first", "second"], log);
    }

    [Fact]
    public void Builds_the_model_from_the_module_configurations()
    {
        using var context = TestDbContext.Create();

        Assert.NotNull(context.Model.FindEntityType(typeof(Note)));
        Assert.NotNull(context.Model.FindEntityType(typeof(Tag)));
    }

    [Fact]
    public void Adds_the_soft_delete_filter_after_the_module_configurations()
    {
        using var context = TestDbContext.Create();

        var filter = context.Model.FindEntityType(typeof(Note))!.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name);

        Assert.NotNull(filter);
    }

    [Fact]
    public void Rejects_missing_model_configurations()
    {
        var options = new DbContextOptionsBuilder<TacticalBoardDbContext>().UseInMemoryDatabase("unused").Options;

        Assert.Throws<ArgumentNullException>(() => new TacticalBoardDbContext(options, null!));
    }
}
