using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.UnitTests.SharedKernel;

public class SoftDeletableEntityTests
{
    private sealed class Entity : SoftDeletableEntity;

    private static readonly DateTimeOffset First = new(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Is_not_deleted_initially()
    {
        var entity = new Entity();

        Assert.Null(entity.DeletedAt);
        Assert.False(entity.IsDeleted);
    }

    [Fact]
    public void Records_the_deletion_time()
    {
        var entity = new Entity();

        entity.MarkDeleted(First);

        Assert.Equal(First, entity.DeletedAt);
        Assert.True(entity.IsDeleted);
    }

    [Fact]
    public void Keeps_the_first_deletion_time()
    {
        var entity = new Entity();
        entity.MarkDeleted(First);

        entity.MarkDeleted(First.AddDays(1));

        Assert.Equal(First, entity.DeletedAt);
    }
}
