using TacticalBoard.Areas.Contracts;
using TacticalBoard.SharedKernel.Persistence;

namespace TacticalBoard.Folders.Domain;

/// <summary>
/// A flat folder in an area (arc42 ch. 1, 8.15): it groups situations; there are no subfolders.
/// Its name is unique among the area's non-deleted folders. It stays in its area for good.
/// Soft-deleted (ch. 8.16), and only while it is empty (checked by <c>FolderService</c>).
/// </summary>
internal sealed class Folder : SoftDeletableEntity
{
    // For EF Core.
    private Folder()
    {
        Name = string.Empty;
        NormalizedName = string.Empty;
    }

    public Guid Id { get; private set; }

    public AreaKind AreaKind { get; private set; }

    /// <summary>The owner of the area (the user of a personal area, the team of a team area).</summary>
    public Guid AreaOwnerId { get; private set; }

    /// <summary>The area the folder lives in.</summary>
    public AreaReference Area => new(AreaKind, AreaOwnerId);

    public string Name { get; private set; }

    /// <summary><see cref="FolderName.Normalized"/> of <see cref="Name"/>; unique per area among non-deleted folders.</summary>
    public string NormalizedName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public Guid CreatedBy { get; private set; }

    /// <summary>When the folder was created or last renamed.</summary>
    public DateTimeOffset UpdatedAt { get; private set; }

    public Guid UpdatedBy { get; private set; }

    /// <summary>A new folder in <paramref name="area"/>.</summary>
    public static Folder Create(Guid id, AreaReference area, FolderName name, DateTimeOffset at, Guid by)
    {
        ArgumentNullException.ThrowIfNull(area);
        ArgumentNullException.ThrowIfNull(name);
        if (id == Guid.Empty)
        {
            throw new ArgumentException("The id must not be empty.", nameof(id));
        }

        var folder = new Folder
        {
            Id = id,
            AreaKind = area.Kind,
            AreaOwnerId = area.OwnerId,
            CreatedAt = at,
            CreatedBy = by,
        };
        folder.Rename(name, at, by);
        return folder;
    }

    /// <summary>Gives the folder another name (uniqueness is checked by the service and the database).</summary>
    public void Rename(FolderName name, DateTimeOffset at, Guid by)
    {
        ArgumentNullException.ThrowIfNull(name);
        Name = name.Value;
        NormalizedName = name.Normalized;
        UpdatedAt = at;
        UpdatedBy = by;
    }
}
