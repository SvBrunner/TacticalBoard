namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// Identifies an area: its kind and the id of its owner (the user for a personal area, the team
/// for a team area). A personal area has no row of its own; it exists with its user.
/// </summary>
public sealed record AreaReference
{
    public AreaReference(AreaKind kind, Guid ownerId)
    {
        if (!Enum.IsDefined(kind))
        {
            throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown area kind.");
        }

        if (ownerId == Guid.Empty)
        {
            throw new ArgumentException("The owner id must not be empty.", nameof(ownerId));
        }

        Kind = kind;
        OwnerId = ownerId;
    }

    /// <summary>The kind of area.</summary>
    public AreaKind Kind { get; }

    /// <summary>The user (personal area) or team (team area) the area belongs to.</summary>
    public Guid OwnerId { get; }

    /// <summary>The personal area of the user <paramref name="userId"/>.</summary>
    public static AreaReference Personal(Guid userId) => new(AreaKind.Personal, userId);
}
