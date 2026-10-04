using Microsoft.EntityFrameworkCore;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class SoftDeleteInterceptorTests
{
    private static readonly DateTimeOffset Now = new(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);

    private static TestDbContext CreateContext() => TestDbContext.Create(new SoftDeleteInterceptor(new FixedClock(Now)));

    [Fact]
    public async Task Turns_a_removal_into_a_soft_delete()
    {
        using var context = CreateContext();
        var note = new Note { Id = Guid.NewGuid(), Text = "note" };
        context.Notes.Add(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        context.Notes.Remove(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        context.ChangeTracker.Clear();

        var stored = await context.Notes.IgnoreQueryFilters().SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(note.Id, stored.Id);
        Assert.Equal(Now, stored.DeletedAt);
    }

    [Fact]
    public void Works_for_synchronous_saves()
    {
        using var context = CreateContext();
        var note = new Note { Id = Guid.NewGuid(), Text = "note" };
        context.Notes.Add(note);
        context.SaveChanges();

        context.Notes.Remove(note);
        context.SaveChanges();
        context.ChangeTracker.Clear();

        Assert.Equal(Now, context.Notes.IgnoreQueryFilters().Single().DeletedAt);
    }

    [Fact]
    public async Task Soft_deletes_derived_types()
    {
        using var context = CreateContext();
        var note = new PinnedNote { Id = Guid.NewGuid(), Text = "pinned", Position = 1 };
        context.Notes.Add(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        context.Notes.Remove(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        context.ChangeTracker.Clear();

        Assert.Equal(Now, (await context.Notes.IgnoreQueryFilters().SingleAsync(TestContext.Current.CancellationToken)).DeletedAt);
    }

    [Fact]
    public async Task Keeps_the_first_deletion_time()
    {
        using var context = CreateContext();
        var earlier = Now.AddDays(-1);
        var note = new Note { Id = Guid.NewGuid(), Text = "note" };
        note.MarkDeleted(earlier);
        context.Notes.Add(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        context.Notes.Remove(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        Assert.Equal(earlier, note.DeletedAt);
    }

    [Fact]
    public async Task Deletes_other_entities_physically()
    {
        using var context = CreateContext();
        var tag = new Tag { Id = Guid.NewGuid(), Name = "tag" };
        context.Tags.Add(tag);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        context.Tags.Remove(tag);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        Assert.Equal(0, await context.Tags.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Leaves_other_changes_alone()
    {
        using var context = CreateContext();
        var note = new Note { Id = Guid.NewGuid(), Text = "note" };
        context.Notes.Add(note);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        note.Text = "changed";
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        Assert.Null(note.DeletedAt);
    }
}
