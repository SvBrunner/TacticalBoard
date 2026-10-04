namespace TacticalBoard.SharedKernel.Persistence;

/// <summary>
/// An entity that is never deleted physically (arc42 ch. 8.16): deleting it sets
/// <see cref="DeletedAt"/>, and from then on it is hidden from all queries.
/// </summary>
public interface ISoftDeletable
{
    /// <summary>When the entity was deleted, or <c>null</c> while it exists.</summary>
    DateTimeOffset? DeletedAt { get; }

    /// <summary>Marks the entity as deleted at <paramref name="deletedAt"/>. Keeps the first deletion time if called again.</summary>
    void MarkDeleted(DateTimeOffset deletedAt);
}
