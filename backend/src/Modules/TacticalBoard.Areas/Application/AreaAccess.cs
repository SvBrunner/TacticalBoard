using TacticalBoard.Areas.Contracts;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary><see cref="IAreaAccess"/>: delegates to the <see cref="IAreaAccessRule"/> of the area's kind; no rule means no access.</summary>
internal sealed class AreaAccess(ICurrentUser currentUser, IEnumerable<IAreaAccessRule> rules) : IAreaAccess
{
    private readonly Dictionary<AreaKind, IAreaAccessRule> _rules = rules.ToDictionary(rule => rule.Kind);

    /// <inheritdoc />
    public AreaReference CurrentUsersPersonalArea() => AreaReference.Personal(currentUser.Id);

    /// <inheritdoc />
    public Task<bool> CanReadAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return _rules.TryGetValue(area.Kind, out var rule) ? rule.CanReadAsync(area, cancellationToken) : Task.FromResult(false);
    }

    /// <inheritdoc />
    public Task<bool> CanWriteAsync(AreaReference area, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return _rules.TryGetValue(area.Kind, out var rule) ? rule.CanWriteAsync(area, cancellationToken) : Task.FromResult(false);
    }
}
