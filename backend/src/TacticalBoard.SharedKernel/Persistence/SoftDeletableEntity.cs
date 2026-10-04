namespace TacticalBoard.SharedKernel.Persistence;

/// <summary>Convenience base class implementing <see cref="ISoftDeletable"/>.</summary>
public abstract class SoftDeletableEntity : ISoftDeletable
{
    /// <inheritdoc />
    public DateTimeOffset? DeletedAt { get; private set; }

    /// <summary>Whether the entity has been deleted.</summary>
    public bool IsDeleted => DeletedAt is not null;

    /// <inheritdoc />
    public void MarkDeleted(DateTimeOffset deletedAt) => DeletedAt ??= deletedAt;
}
