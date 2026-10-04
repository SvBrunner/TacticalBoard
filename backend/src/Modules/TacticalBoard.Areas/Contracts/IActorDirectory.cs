namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// The users acting in areas, for content that records who created or changed it (arc42 ch. 1:
/// "created/changed by"). Hands the Users module's answers on to Situations and Folders, which
/// may not use Users directly (ch. 5.2).
/// </summary>
public interface IActorDirectory
{
    /// <summary>The id of the current (logged-in) user.</summary>
    /// <exception cref="InvalidOperationException">The request has no logged-in user.</exception>
    Guid CurrentUserId { get; }

    /// <summary>The display names of the users among <paramref name="userIds"/> that still exist; deleted users are missing.</summary>
    Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken);
}
