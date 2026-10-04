namespace TacticalBoard.Users.Application;

/// <summary>A user with the same issuer + subject exists already.</summary>
internal sealed class DuplicateUserIdentityException : Exception
{
    public DuplicateUserIdentityException()
        : base("A user with this identity exists already.")
    {
    }

    public DuplicateUserIdentityException(string message)
        : base(message)
    {
    }

    public DuplicateUserIdentityException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
