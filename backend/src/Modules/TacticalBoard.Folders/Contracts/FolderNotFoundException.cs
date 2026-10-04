using TacticalBoard.SharedKernel.Errors;

namespace TacticalBoard.Folders.Contracts;

/// <summary>
/// The folder doesn't exist, is deleted, lies in an area the current user can't read, or (as the
/// target of a situation) lies in another area than the situation — no hint which (arc42 ch. 8.15).
/// Public, so Situations reports an unusable folder with the same error.
/// </summary>
public sealed class FolderNotFoundException(Guid id)
    : DomainException(DomainErrorKind.NotFound, "folder-not-found", "Folder not found", $"There is no folder {id} here.");
