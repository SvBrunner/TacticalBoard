using System.Security.Cryptography;

namespace TacticalBoard.Teams.Domain;

/// <summary>
/// A team logo ready to be stored (arc42 ch. 8.17): already scaled down to fit
/// <see cref="MaxSide"/> × <see cref="MaxSide"/> px and re-encoded without metadata (by an
/// <c>ILogoImageProcessor</c>). <see cref="Hash"/> identifies the content; it is the logo's ETag
/// and makes its URL change when the logo changes.
/// </summary>
internal sealed class TeamLogoImage
{
    /// <summary>The longest side of a stored logo, in pixels (arc42 ch. 1: at most 256 × 256 px).</summary>
    public const int MaxSide = 256;

    private readonly byte[] _content;

    private TeamLogoImage(byte[] content, string contentType, int width, int height)
    {
        _content = content;
        ContentType = contentType;
        Width = width;
        Height = height;
        Hash = HashOf(content);
    }

    /// <summary>The encoded image.</summary>
    public ReadOnlyMemory<byte> Content => _content;

    /// <summary>The media type of <see cref="Content"/>, e.g. <c>image/png</c>.</summary>
    public string ContentType { get; }

    public int Width { get; }

    public int Height { get; }

    /// <summary>The first 128 bits of the content's SHA-256, as 32 lower-case hex digits.</summary>
    public string Hash { get; }

    /// <summary>A processed logo.</summary>
    /// <exception cref="ArgumentException">Empty content, no media type, or a side outside 1 … <see cref="MaxSide"/>.</exception>
    public static TeamLogoImage Create(byte[] content, string contentType, int width, int height)
    {
        ArgumentNullException.ThrowIfNull(content);
        ArgumentException.ThrowIfNullOrWhiteSpace(contentType);
        if (content.Length == 0)
        {
            throw new ArgumentException("A logo needs content.", nameof(content));
        }

        if (width is < 1 or > MaxSide || height is < 1 or > MaxSide)
        {
            throw new ArgumentException($"A logo is at most {MaxSide} × {MaxSide} px, not {width} × {height}.", nameof(width));
        }

        return new TeamLogoImage((byte[])content.Clone(), contentType, width, height);
    }

    /// <summary>The hash <see cref="Hash"/> is computed with.</summary>
    public static string HashOf(ReadOnlySpan<byte> content) => Convert.ToHexStringLower(SHA256.HashData(content)[..16]);
}
