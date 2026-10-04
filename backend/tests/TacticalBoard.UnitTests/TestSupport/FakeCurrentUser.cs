using TacticalBoard.Users.Contracts;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="ICurrentUser"/> that is a given user, or nobody.</summary>
internal sealed class FakeCurrentUser(Guid? id) : ICurrentUser
{
    public Guid? UserId { get; set; } = id;

    public bool IsAuthenticated => UserId is not null;

    public Guid Id => UserId ?? throw new InvalidOperationException("The request has no logged-in user.");

    public bool IsSystemAdministrator { get; set; }
}
