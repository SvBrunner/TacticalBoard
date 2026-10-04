namespace TacticalBoard.Users.Contracts;

/// <summary>
/// The user of the current request, for every module (arc42 ch. 5.2). Set once the session has
/// been validated for this request (the user exists, is neither blocked nor deleted); the
/// system administrator flag is read fresh for every request.
/// </summary>
public interface ICurrentUser
{
    /// <summary>Whether the request has a valid session.</summary>
    bool IsAuthenticated { get; }

    /// <summary>The user's id.</summary>
    /// <exception cref="InvalidOperationException">The request has no valid session.</exception>
    Guid Id { get; }

    /// <summary>Whether the user is a system administrator (<c>false</c> without a session).</summary>
    bool IsSystemAdministrator { get; }
}
