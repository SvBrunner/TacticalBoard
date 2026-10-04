using TacticalBoard.Areas.Contracts;
using TacticalBoard.Users.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary>A personal area: only its owner may read and write it (arc42 ch. 8.1), system administrators included.</summary>
internal sealed class PersonalAreaAccessRule(ICurrentUser currentUser) : IAreaAccessRule
{
    /// <inheritdoc />
    public AreaKind Kind => AreaKind.Personal;

    /// <inheritdoc />
    public Task<bool> CanReadAsync(AreaReference area, CancellationToken cancellationToken) => Task.FromResult(IsOwner(area));

    /// <inheritdoc />
    public Task<bool> CanWriteAsync(AreaReference area, CancellationToken cancellationToken) => Task.FromResult(IsOwner(area));

    private bool IsOwner(AreaReference area)
    {
        ArgumentNullException.ThrowIfNull(area);
        return area.Kind == AreaKind.Personal && currentUser.IsAuthenticated && currentUser.Id == area.OwnerId;
    }
}
