namespace TacticalBoard.Users.Contracts;

/// <summary>
/// Looks up users for other modules, e.g. to show who created or changed a situation
/// (arc42 ch. 1, "created/changed by").
/// </summary>
public interface IUserDirectory
{
    /// <summary>
    /// The display names of the users in <paramref name="userIds"/> that still exist. Deleted
    /// users are missing from the result (the caller shows them as "Deleted user").
    /// </summary>
    Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken);
}
