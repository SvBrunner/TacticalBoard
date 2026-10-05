using TacticalBoard.Teams.Domain;

namespace TacticalBoard.UnitTests.Teams;

public class TeamLogoImageTests
{
    [Fact]
    public void Keeps_a_copy_of_the_content_and_hashes_it()
    {
        byte[] content = [1, 2, 3];

        var logo = TeamLogoImage.Create(content, "image/png", 256, 100);
        content[0] = 9;

        Assert.Equal([1, 2, 3], logo.Content.ToArray());
        Assert.Equal(("image/png", 256, 100), (logo.ContentType, logo.Width, logo.Height));
        Assert.Equal(32, logo.Hash.Length);
        Assert.Matches("^[0-9a-f]{32}$", logo.Hash);
        Assert.Equal(TeamLogoImage.HashOf([1, 2, 3]), logo.Hash);
        Assert.NotEqual(TeamLogoImage.HashOf([1, 2, 4]), logo.Hash);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(10, 0)]
    [InlineData(257, 10)]
    [InlineData(10, 257)]
    public void Is_at_most_256_px_on_each_side(int width, int height)
    {
        Assert.Equal(256, TeamLogoImage.MaxSide);
        Assert.Throws<ArgumentException>(() => TeamLogoImage.Create([1], "image/png", width, height));
    }

    [Fact]
    public void Needs_content_and_a_media_type()
    {
        Assert.Throws<ArgumentException>(() => TeamLogoImage.Create([], "image/png", 1, 1));
        Assert.Throws<ArgumentException>(() => TeamLogoImage.Create([1], " ", 1, 1));
        Assert.Throws<ArgumentNullException>(() => TeamLogoImage.Create(null!, "image/png", 1, 1));
    }

    [Fact]
    public void The_stored_logo_carries_the_image_and_who_set_it()
    {
        var teamId = Guid.NewGuid();
        var by = Guid.NewGuid();
        var image = TeamLogoImage.Create([7, 8], "image/png", 2, 2);
        var at = DateTimeOffset.UnixEpoch;

        var logo = TeamLogo.Of(teamId, image, at, by);

        Assert.Equal((teamId, "image/png", image.Hash, at, by), (logo.TeamId, logo.ContentType, logo.Hash, logo.UpdatedAt, logo.UpdatedBy));
        Assert.Equal([7, 8], logo.Content);
        Assert.Throws<ArgumentException>(() => TeamLogo.Of(Guid.Empty, image, at, by));
    }
}
