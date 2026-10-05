using TacticalBoard.Areas.Contracts;

namespace TacticalBoard.Situations.Application;

/// <summary>
/// The Situations part of an area going away (Areas' <see cref="IAreaContentDeletion"/>, arc42 ch.
/// 5.2, 8.16, ADR-015): soft-deletes all the area's situations — a deleted team's — in the deleting
/// transaction; their revisions stay.
/// </summary>
internal sealed class SituationAreaContentDeletion(ISituationRepository situations) : IAreaContentDeletion
{
    /// <inheritdoc />
    public Task DeleteContentAsync(AreaReference area, DateTimeOffset deletedAt, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(area);
        return situations.DeleteAllInAreaAsync(area, deletedAt, cancellationToken);
    }
}
