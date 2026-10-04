using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>A soft-deletable test entity (root of a small hierarchy).</summary>
internal class Note : SoftDeletableEntity
{
    public Guid Id { get; set; }

    public string Text { get; set; } = string.Empty;
}

/// <summary>A derived type of <see cref="Note"/>; it inherits the root's query filter.</summary>
internal sealed class PinnedNote : Note
{
    public int Position { get; set; }
}

/// <summary>A test entity that is not soft-deletable.</summary>
internal sealed class Tag
{
    public Guid Id { get; set; }

    public string Name { get; set; } = string.Empty;
}

internal sealed class NoteConfiguration : IEntityTypeConfiguration<Note>
{
    public void Configure(EntityTypeBuilder<Note> builder) => builder.HasKey(note => note.Id);
}

internal sealed class PinnedNoteConfiguration : IEntityTypeConfiguration<PinnedNote>
{
    public void Configure(EntityTypeBuilder<PinnedNote> builder) => builder.HasBaseType<Note>();
}

internal sealed class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder) => builder.HasKey(tag => tag.Id);
}

/// <summary>A model configuration that records whether (and in which order) it was applied.</summary>
internal sealed class RecordingModelConfiguration(string name, List<string> log) : IModelConfiguration
{
    public void Configure(ModelBuilder modelBuilder) => log.Add(name);
}

/// <summary>A <see cref="TacticalBoardDbContext"/> on the in-memory provider with the test entities.</summary>
internal sealed class TestDbContext : TacticalBoardDbContext
{
    public TestDbContext(DbContextOptions<TestDbContext> options, IEnumerable<IModelConfiguration> configurations)
        : base(options, configurations)
    {
    }

    public static TestDbContext Create(params IModelConfiguration[] configurations) =>
        Create(new SoftDeleteInterceptor(new FixedClock(DateTimeOffset.UnixEpoch)), configurations);

    public static TestDbContext Create(SoftDeleteInterceptor interceptor, params IModelConfiguration[] configurations)
    {
        var options = new DbContextOptionsBuilder<TestDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            // A fresh internal service provider per context, so every test builds its own model.
            .EnableServiceProviderCaching(false)
            .AddInterceptors(interceptor)
            .Options;
        return new TestDbContext(options, configurations.Length > 0 ? configurations : [new AssemblyModelConfiguration(typeof(Note).Assembly)]);
    }

    public DbSet<Note> Notes => Set<Note>();

    public DbSet<Tag> Tags => Set<Tag>();
}
