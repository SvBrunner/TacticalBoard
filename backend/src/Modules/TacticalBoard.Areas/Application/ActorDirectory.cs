using TacticalBoard.Areas.Contracts;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary><see cref="IActorDirectory"/> on the Users module's contracts.</summary>
internal sealed class ActorDirectory(ICurrentUser currentUser, IUserDirectory users) : IActorDirectory
{
    /// <inheritdoc />
    public Guid CurrentUserId => currentUser.Id;

    /// <inheritdoc />
    public Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken) =>
        users.FindDisplayNamesAsync(userIds, cancellationToken);
}
