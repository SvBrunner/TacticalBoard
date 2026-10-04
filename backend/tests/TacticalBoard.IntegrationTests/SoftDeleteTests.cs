using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.Extensions.Time.Testing;
using TacticalBoard.Infrastructure.Persistence;
using TacticalBoard.Infrastructure.Time;
using TacticalBoard.IntegrationTests.TestSupport;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.IntegrationTests;

/// <summary>The soft-delete plumbing and naming conventions on a real PostgreSQL database.</summary>
public sealed class SoftDeleteTests(PostgresFixture postgres) : IAsyncLifetime
{
    internal sealed class Board : SoftDeletableEntity
    {
        public Guid Id { get; set; }

        public string DisplayTitle { get; set; } = string.Empty;
    }

    internal sealed class BoardConfiguration : IEntityTypeConfiguration<Board>
    {
        public void Configure(EntityTypeBuilder<Board> builder) => builder.HasKey(board => board.Id);
    }

    private sealed class BoardModel : IModelConfiguration
    {
        public void Configure(ModelBuilder modelBuilder) => modelBuilder.ApplyConfiguration(new BoardConfiguration());
    }

    private sealed class BoardDbContext(DbContextOptions<BoardDbContext> options)
        : TacticalBoardDbContext(options, [new BoardModel()])
    {
        public DbSet<Board> Boards => Set<Board>();
    }

    private static readonly DateTimeOffset Now = new(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);

    private readonly string _connectionString = postgres.NewDatabaseConnectionString();

    private BoardDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<BoardDbContext>()
            .UseNpgsql(_connectionString)
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(new SoftDeleteInterceptor(new SystemClock(new FakeTimeProvider(Now))))
            .Options);

    public async ValueTask InitializeAsync()
    {
        await using var context = CreateContext();
        await context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;

    private async Task<Guid> AddBoardAsync(string title)
    {
        await using var context = CreateContext();
        var board = new Board { Id = Guid.CreateVersion7(), DisplayTitle = title };
        context.Boards.Add(board);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return board.Id;
    }

    private async Task RemoveBoardAsync(Guid id)
    {
        await using var context = CreateContext();
        context.Boards.Remove(await context.Boards.SingleAsync(board => board.Id == id, TestContext.Current.CancellationToken));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task Removing_keeps_the_row_and_sets_deleted_at()
    {
        var id = await AddBoardAsync("Powerplay");

        await RemoveBoardAsync(id);

        await using var context = CreateContext();
        var stored = await context.Boards.IgnoreQueryFilters([SoftDeleteQueryFilter.Name]).SingleAsync(TestContext.Current.CancellationToken);
        Assert.Equal(id, stored.Id);
        Assert.Equal(Now, stored.DeletedAt);
    }

    [Fact]
    public async Task Deleted_rows_disappear_from_queries()
    {
        var kept = await AddBoardAsync("Kept");
        await RemoveBoardAsync(await AddBoardAsync("Removed"));

        await using var context = CreateContext();
        var ids = await context.Boards.Select(board => board.Id).ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal([kept], ids);
        Assert.Equal(2, await context.Boards.IgnoreQueryFilters().CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task Tables_and_columns_use_snake_case()
    {
        var columns = await PostgresQueries.ColumnsAsync(_connectionString, "boards", TestContext.Current.CancellationToken);

        Assert.Equal(["deleted_at", "display_title", "id"], columns);
    }
}
