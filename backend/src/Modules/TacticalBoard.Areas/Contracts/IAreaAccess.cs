namespace TacticalBoard.Areas.Contracts;

/// <summary>
/// Answers whether the current user may read or write in an area (arc42 ch. 5.2, 8.1). Situations
/// and Folders ask this instead of checking roles themselves. A personal area: only its owner; a
/// team area: every member reads, Admins and Editors write (ch. 8.1). System administrators have no
/// access as such. A kind without a rule is denied.
/// </summary>
public interface IAreaAccess
{
    /// <summary>The personal area of the current user.</summary>
    /// <exception cref="InvalidOperationException">The request has no logged-in user.</exception>
    AreaReference CurrentUsersPersonalArea();

    /// <summary>Whether the current user may see the area and its content.</summary>
    Task<bool> CanReadAsync(AreaReference area, CancellationToken cancellationToken);

    /// <summary>Whether the current user may create, change and delete content in the area.</summary>
    Task<bool> CanWriteAsync(AreaReference area, CancellationToken cancellationToken);
}
