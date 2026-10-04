namespace TacticalBoard.Users.Contracts;

/// <summary>Why a login gets no session.</summary>
public enum SignInRejection
{
    /// <summary>The user is blocked.</summary>
    Blocked,

    /// <summary>The issuer or subject is unusable (empty or longer than allowed).</summary>
    InvalidIdentity,
}

/// <summary>The outcome of <see cref="IUserAuthentication.SignInAsync"/>: a user id, or why there is no session.</summary>
public sealed record UserSignInResult
{
    private UserSignInResult(Guid? userId, SignInRejection? rejection)
    {
        UserId = userId;
        Rejection = rejection;
    }

    /// <summary>The signed-in user, when <see cref="Succeeded"/>.</summary>
    public Guid? UserId { get; }

    /// <summary>Why the login was rejected, when not <see cref="Succeeded"/>.</summary>
    public SignInRejection? Rejection { get; }

    /// <summary>Whether the user gets a session.</summary>
    public bool Succeeded => UserId is not null;

    /// <summary>A successful sign-in of <paramref name="userId"/>.</summary>
    public static UserSignInResult Success(Guid userId) => new(userId, null);

    /// <summary>A rejected sign-in.</summary>
    public static UserSignInResult Rejected(SignInRejection rejection) => new(null, rejection);
}
