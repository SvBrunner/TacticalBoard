namespace TacticalBoard.Users.Contracts;

/// <summary>
/// What the host's login (BFF, arc42 ch. 8.13) needs from the Users module: map a login to a
/// local user, and check an existing session on every request.
/// </summary>
public interface IUserAuthentication
{
    /// <summary>
    /// Signs in the identity of <paramref name="login"/>: finds its user or creates it on the
    /// first login (just in time; after a deleted account a new, empty one), applies the
    /// bootstrap of system administrators (ch. 8.14), and rejects blocked users.
    /// </summary>
    Task<UserSignInResult> SignInAsync(ExternalLogin login, CancellationToken cancellationToken);

    /// <summary>
    /// Resumes the session of <paramref name="userId"/> for the current request: <c>true</c> and
    /// <see cref="ICurrentUser"/> set when the user exists and is neither blocked nor deleted;
    /// otherwise <c>false</c>, and the session must end.
    /// </summary>
    Task<bool> ResumeSessionAsync(Guid userId, CancellationToken cancellationToken);
}
