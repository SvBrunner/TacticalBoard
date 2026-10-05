using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Areas.Application;

/// <summary>
/// The access rule for one <see cref="AreaKind"/>: <see cref="PersonalAreaAccessRule"/> and
/// <see cref="TeamAreaAccessRule"/> (asking Teams' role matrix, ch. 8.1).
/// </summary>
internal interface IAreaAccessRule
{
    /// <summary>The kind of area this rule decides about.</summary>
    AreaKind Kind { get; }

    Task<bool> CanReadAsync(AreaReference area, CancellationToken cancellationToken);

    Task<bool> CanWriteAsync(AreaReference area, CancellationToken cancellationToken);
}
