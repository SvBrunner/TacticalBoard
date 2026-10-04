using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class SoftDeleteQueryFilterTests
{
    private static readonly DateTimeOffset Deleted = new(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Adds_a_named_filter_to_soft_deletable_root_types()
    {
        using var context = TestDbContext.Create();

        Assert.NotNull(context.Model.FindEntityType(typeof(Note))!.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));
    }

    [Fact]
    public void Adds_no_filter_to_derived_types_which_inherit_the_roots()
    {
        using var context = TestDbContext.Create();

        Assert.Null(context.Model.FindEntityType(typeof(PinnedNote))!.FindDeclaredQueryFilter(SoftDeleteQueryFilter.Name));
    }

    [Fact]
    public void Adds_no_filter_to_other_types()
    {
        using var context = TestDbContext.Create();

        Assert.Empty(context.Model.FindEntityType(typeof(Tag))!.GetDeclaredQueryFilters());
    }

    [Fact]
    public async Task Hides_deleted_rows_from_queries()
    {
        using var context = TestDbContext.Create();
        var deleted = new Note { Id = Guid.NewGuid(), Text = "deleted" };
        deleted.MarkDeleted(Deleted);
        var deletedPinned = new PinnedNote { Id = Guid.NewGuid(), Text = "deleted pinned" };
        deletedPinned.MarkDeleted(Deleted);
        context.Notes.AddRange(new Note { Id = Guid.NewGuid(), Text = "kept" }, deleted, deletedPinned);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        context.ChangeTracker.Clear();

        var texts = await context.Notes.Select(note => note.Text).ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(["kept"], texts);
    }

    [Fact]
    public async Task Can_be_ignored_by_name()
    {
        using var context = TestDbContext.Create();
        var deleted = new Note { Id = Guid.NewGuid(), Text = "deleted" };
        deleted.MarkDeleted(Deleted);
        context.Notes.AddRange(new Note { Id = Guid.NewGuid(), Text = "kept" }, deleted);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        context.ChangeTracker.Clear();

        var count = await context.Notes.IgnoreQueryFilters([SoftDeleteQueryFilter.Name]).CountAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, count);
    }
}
