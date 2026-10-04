using TacticalBoard.SharedKernel.Identifiers;
using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.Infrastructure.Identifiers;

/// <summary>
/// Creates version 7 UUIDs (RFC 9562): globally unique and ordered by creation time,
/// which keeps database indexes on them compact.
/// </summary>
public sealed class SequentialGuidGenerator(IClock clock) : IIdGenerator
{
    /// <inheritdoc />
    public Guid NewId() => Guid.CreateVersion7(clock.UtcNow);
}
