using TacticalBoard.SharedKernel.Time;

namespace TacticalBoard.Infrastructure.Time;

/// <summary><see cref="IClock"/> backed by a <see cref="TimeProvider"/> (the system clock in production).</summary>
public sealed class SystemClock(TimeProvider timeProvider) : IClock
{
    /// <inheritdoc />
    public DateTimeOffset UtcNow => timeProvider.GetUtcNow();
}
