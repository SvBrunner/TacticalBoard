namespace TacticalBoard.SharedKernel.Time;

/// <summary>The current point in time. Domain and application code ask this instead of the system clock.</summary>
public interface IClock
{
    /// <summary>The current instant, in UTC (offset zero).</summary>
    DateTimeOffset UtcNow { get; }
}
