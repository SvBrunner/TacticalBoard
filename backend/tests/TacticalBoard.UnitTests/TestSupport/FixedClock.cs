using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>An <see cref="IClock"/> that returns a settable instant.</summary>
internal sealed class FixedClock(DateTimeOffset now) : IClock
{
    public DateTimeOffset UtcNow { get; set; } = now;
}
