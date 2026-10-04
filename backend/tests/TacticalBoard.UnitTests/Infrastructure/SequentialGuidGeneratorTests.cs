using TacticalBoard.Infrastructure.Identifiers;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Infrastructure;

public class SequentialGuidGeneratorTests
{
    private static readonly DateTimeOffset Start = new(2026, 3, 1, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Creates_version_7_uuids()
    {
        var generator = new SequentialGuidGenerator(new FixedClock(Start));

        Assert.Equal(7, generator.NewId().Version);
    }

    [Fact]
    public void Creates_unique_ids_at_the_same_instant()
    {
        var generator = new SequentialGuidGenerator(new FixedClock(Start));

        var ids = Enumerable.Range(0, 1000).Select(_ => generator.NewId()).ToHashSet();

        Assert.Equal(1000, ids.Count);
    }

    [Fact]
    public void Orders_ids_by_the_clocks_time()
    {
        var clock = new FixedClock(Start);
        var generator = new SequentialGuidGenerator(clock);

        var earlier = generator.NewId();
        clock.UtcNow = Start.AddMilliseconds(1);
        var later = generator.NewId();

        // Version 7 UUIDs start with the Unix time in milliseconds, so their text sorts by creation time.
        Assert.True(string.CompareOrdinal(earlier.ToString(), later.ToString()) < 0);
    }

    [Fact]
    public void Embeds_the_clocks_timestamp()
    {
        var generator = new SequentialGuidGenerator(new FixedClock(Start));

        var id = generator.NewId();

        var unixMilliseconds = Convert.ToInt64(id.ToString("N")[..12], 16);
        Assert.Equal(Start.ToUnixTimeMilliseconds(), unixMilliseconds);
    }
}
