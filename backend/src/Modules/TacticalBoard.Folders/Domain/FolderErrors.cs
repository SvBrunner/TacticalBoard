using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Folders.Domain;

/// <summary>The current user may read but not change the folders of the area (e.g. a team Reader, later).</summary>
internal sealed class FolderAccessDeniedException()
    : DomainException(DomainErrorKind.Forbidden, "forbidden", "Forbidden", "You may not change folders in this area.");

/// <summary>Another non-deleted folder of the area has this name (ignoring case and surrounding whitespace).</summary>
internal sealed class DuplicateFolderNameException(string name)
    : DomainException(DomainErrorKind.Conflict, "duplicate-folder-name", "Duplicate folder name", $"A folder named \"{name}\" already exists here.")
{
    /// <inheritdoc />
    public override IReadOnlyDictionary<string, object?> Details { get; } = new Dictionary<string, object?> { ["existingName"] = name };
}

/// <summary>The folder still contains situations, so it can't be deleted (arc42 ch. 1, 8.16).</summary>
internal sealed class FolderNotEmptyException(string name)
    : DomainException(
        DomainErrorKind.Conflict,
        "folder-not-empty",
        "Folder not empty",
        $"The folder \"{name}\" still contains situations. Move or delete them first.");
