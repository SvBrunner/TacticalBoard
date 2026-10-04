using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Users.Application;

/// <summary>
/// The per-request <see cref="ICurrentUser"/>: empty until the session is resumed
/// (<see cref="UserAuthenticationService.ResumeSessionAsync"/>), then the user's snapshot.
/// </summary>
internal sealed class CurrentUserState : ICurrentUser
{
    private SessionUser? _user;

    /// <inheritdoc />
    public bool IsAuthenticated => _user is not null;

    /// <inheritdoc />
    public Guid Id => User.Id;

    /// <inheritdoc />
    public bool IsSystemAdministrator => _user?.IsSystemAdministrator ?? false;

    /// <summary>The current user's snapshot.</summary>
    /// <exception cref="InvalidOperationException">The request has no valid session.</exception>
    public SessionUser User => _user ?? throw new InvalidOperationException("The request has no logged-in user.");

    public void Set(SessionUser user)
    {
        ArgumentNullException.ThrowIfNull(user);
        _user = user;
    }

    /// <summary>Replaces the snapshot after the user changed (e.g. a new display name).</summary>
    public void Refresh(SessionUser user) => Set(user);
}
