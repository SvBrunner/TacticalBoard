namespace TacticalBoard.Teams.Domain;

/// <summary>
/// The stored logo of a team (table <c>team_logos</c>, one row per team that has a logo; arc42
/// ch. 8.17). Kept apart from <see cref="Team"/>, so listing teams never loads image bytes. Removing
/// or replacing a logo is no deletion of an item: the row is replaced or removed (not soft-deleted).
/// </summary>
internal sealed class TeamLogo
{
    // For EF Core.
    private TeamLogo()
    {
        Content = [];
        ContentType = string.Empty;
        Hash = string.Empty;
    }

    public Guid TeamId { get; private set; }

#pragma warning disable CA1819 // The encoded image, mapped by EF Core to a bytea column.
    public byte[] Content { get; private set; }
#pragma warning restore CA1819

    public string ContentType { get; private set; }

    /// <summary><see cref="TeamLogoImage.Hash"/> of <see cref="Content"/>; the logo's ETag.</summary>
    public string Hash { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public Guid UpdatedBy { get; private set; }

    /// <summary>The logo of <paramref name="teamId"/>.</summary>
    public static TeamLogo Of(Guid teamId, TeamLogoImage image, DateTimeOffset at, Guid by)
    {
        ArgumentNullException.ThrowIfNull(image);
        if (teamId == Guid.Empty)
        {
            throw new ArgumentException("The team id must not be empty.", nameof(teamId));
        }

        return new TeamLogo
        {
            TeamId = teamId,
            Content = image.Content.ToArray(),
            ContentType = image.ContentType,
            Hash = image.Hash,
            UpdatedAt = at,
            UpdatedBy = by,
        };
    }
}
