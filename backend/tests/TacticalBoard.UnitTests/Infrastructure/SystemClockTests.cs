using Microsoft.Extensions.Time.Testing;
using TacticalBoard.Infrastructure.Time;

namespace TacticalBoard.UnitTests.Infrastructure;

public class SystemClockTests
{
    [Fact]
    public void Returns_the_time_providers_current_utc_time()
    {
        var start = new DateTimeOffset(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);
        var timeProvider = new FakeTimeProvider(start);
        var clock = new SystemClock(timeProvider);

        Assert.Equal(start, clock.UtcNow);
        timeProvider.Advance(TimeSpan.FromMinutes(5));
        Assert.Equal(start.AddMinutes(5), clock.UtcNow);
    }

    [Fact]
    public void Returns_utc()
    {
        var clock = new SystemClock(TimeProvider.System);

        Assert.Equal(TimeSpan.Zero, clock.UtcNow.Offset);
    }
}
