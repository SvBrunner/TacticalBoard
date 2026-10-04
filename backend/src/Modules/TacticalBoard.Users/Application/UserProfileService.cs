using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Application;

/// <summary>Changes to the current user's own profile.</summary>
internal sealed class UserProfileService(IUserRepository users, CurrentUserState currentUser)
{
    /// <summary>Sets the current user's display name; it is never overwritten by the IdP afterwards.</summary>
    /// <returns>The user's updated snapshot.</returns>
    public async Task<SessionUser> ChangeDisplayNameAsync(DisplayName displayName, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(displayName);
        var user = await users.FindAsync(currentUser.Id, cancellationToken)
            ?? throw new InvalidOperationException("The current user no longer exists.");

        user.ChangeDisplayName(displayName);
        await users.SaveChangesAsync(cancellationToken);

        var updated = currentUser.User with { DisplayName = user.DisplayName.Value };
        currentUser.Refresh(updated);
        return updated;
    }
}
