using TacticalBoard.Users.Domain;

namespace TacticalBoard.Users.Application;

/// <summary>
/// The bootstrap rule of arc42 ch. 8.14: a configured identity becomes system administrator when
/// it logs in for the very first time, or when no active (neither blocked nor deleted) system
/// administrator exists. Otherwise the role is managed in the app only, so revoking it sticks.
/// </summary>
internal sealed class SystemAdministratorBootstrap(BootstrapAdministrators configured, IUserRepository users)
{
    /// <summary>Grants <paramref name="user"/> the role if the rule says so. Does not save.</summary>
    /// <returns>Whether the role was granted.</returns>
    public async Task<bool> ApplyAsync(User user, bool isFirstLogin, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(user);
        if (user.IsSystemAdministrator || !configured.Contains(user.Identity))
        {
            return false;
        }

        if (!isFirstLogin && await users.AnyActiveSystemAdministratorAsync(cancellationToken))
        {
            return false;
        }

        user.GrantSystemAdministrator();
        return true;
    }
}
