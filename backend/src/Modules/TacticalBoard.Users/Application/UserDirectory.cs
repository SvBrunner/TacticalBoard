using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Users.Application;

/// <summary><see cref="IUserDirectory"/> on the user repository.</summary>
internal sealed class UserDirectory(IUserRepository users) : IUserDirectory
{
    /// <inheritdoc />
    public async Task<IReadOnlyDictionary<Guid, string>> FindDisplayNamesAsync(IReadOnlyCollection<Guid> userIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        if (userIds.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        return await users.FindDisplayNamesAsync(userIds.Distinct().ToList(), cancellationToken);
    }
}
