using TacticalBoard.SharedKernel.Validation;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Application;

/// <summary>
/// The rules for an uploaded team logo (arc42 ch. 8.17) and its validation problems, each with a
/// stable code (ch. 8.2). The limits are technical decisions.
/// </summary>
internal static class LogoUpload
{
    /// <summary>The largest upload accepted: 5 MiB (enough for a phone photo; the stored logo is far smaller).</summary>
    public const int MaxBytes = 5 * 1024 * 1024;

    /// <summary>The largest image accepted, in pixels (width × height) of the uploaded image: 25 megapixels.</summary>
    public const int MaxMegapixels = 25;

    /// <summary>The media types accepted (detected from the content, not from the file name or declared type).</summary>
    public static readonly IReadOnlyList<string> AcceptedContentTypes = ["image/png", "image/jpeg", "image/webp"];

    /// <summary>The upload is larger than <see cref="MaxBytes"/>: code <c>file-too-large</c> with <c>maxBytes</c>.</summary>
    public static FieldError FileTooLarge() =>
        FieldError.Of("file-too-large", $"must be at most {MaxBytes} bytes", ("maxBytes", MaxBytes));

    /// <summary>The upload is no readable PNG, JPEG or WebP image (e.g. SVG, GIF, or a damaged file): code <c>unsupported-image</c>.</summary>
    public static FieldError UnsupportedImage() =>
        FieldError.Of("unsupported-image", "must be a PNG, JPEG or WebP image");

    /// <summary>The image has more than <see cref="MaxMegapixels"/> megapixels: code <c>image-too-large</c> with <c>maxMegapixels</c>.</summary>
    public static FieldError ImageTooLarge() =>
        FieldError.Of("image-too-large", $"must have at most {MaxMegapixels} megapixels", ("maxMegapixels", MaxMegapixels));

    /// <summary>The stored logo's longest side (<see cref="TeamLogoImage.MaxSide"/>).</summary>
    public static int MaxSide => TeamLogoImage.MaxSide;
}

/// <summary>The outcome of processing an uploaded logo: the logo to store, or why the upload is unusable.</summary>
internal sealed record LogoProcessingResult
{
    private LogoProcessingResult(TeamLogoImage? logo, FieldError? error)
    {
        Logo = logo;
        Error = error;
    }

    public TeamLogoImage? Logo { get; }

    public FieldError? Error { get; }

    public static LogoProcessingResult Success(TeamLogoImage logo) => new(logo ?? throw new ArgumentNullException(nameof(logo)), null);

    public static LogoProcessingResult Failure(FieldError error) => new(null, error ?? throw new ArgumentNullException(nameof(error)));
}

/// <summary>
/// Turns an uploaded image into a team logo (arc42 ch. 8.17): accepts PNG, JPEG and WebP (detected
/// from the content; never SVG), turns it upright (EXIF orientation), scales it down to fit
/// <see cref="TeamLogoImage.MaxSide"/> × <see cref="TeamLogoImage.MaxSide"/> px (never up), and
/// re-encodes it as PNG, which drops all metadata (EXIF, comments, color profiles).
/// </summary>
internal interface ILogoImageProcessor
{
    /// <summary>Processes <paramref name="upload"/> (at most <see cref="LogoUpload.MaxBytes"/>, checked by the caller).</summary>
    LogoProcessingResult Process(ReadOnlySpan<byte> upload);
}
