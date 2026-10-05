using System.Globalization;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Teams.Application;

/// <summary>The display names of team members and requesters, from Users (<see cref="IUserDirectory"/>); a deleted user has none.</summary>
internal sealed class TeamMemberNames(IUserDirectory users)
{
    private static readonly StringComparer IgnoringCase = StringComparer.Create(CultureInfo.InvariantCulture, CompareOptions.IgnoreCase);

    /// <summary>The display names of <paramref name="userIds"/> (one query); deleted users are missing.</summary>
    public Task<IReadOnlyDictionary<Guid, string>> OfAsync(IEnumerable<Guid> userIds, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(userIds);
        return users.FindDisplayNamesAsync(userIds.Distinct().ToList(), cancellationToken);
    }

    /// <summary>The display name of <paramref name="userId"/>, or <c>null</c> for a deleted user.</summary>
    public async Task<string?> OfAsync(Guid userId, CancellationToken cancellationToken) =>
        (await OfAsync([userId], cancellationToken)).GetValueOrDefault(userId);

    /// <summary>
    /// The member list's order: by display name (ignoring case, culture-invariant; then exactly),
    /// deleted users last; then by user id, so the order is stable.
    /// </summary>
    public static IReadOnlyList<TeamMemberView> Ordered(IEnumerable<TeamMemberView> members) =>
        members
            .OrderBy(member => member.DisplayName is null)
            .ThenBy(member => member.DisplayName, IgnoringCase)
            .ThenBy(member => member.DisplayName, StringComparer.Ordinal)
            .ThenBy(member => member.UserId)
            .ToList();
}
