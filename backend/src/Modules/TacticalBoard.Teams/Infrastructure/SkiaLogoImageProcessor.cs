using SkiaSharp;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Domain;

namespace TacticalBoard.Teams.Infrastructure;

/// <summary>
/// <see cref="ILogoImageProcessor"/> with SkiaSharp (MIT, ADR-014): detects the format from the
/// content, decodes (JPEG and WebP at a reduced size where possible, saving memory), applies the
/// EXIF orientation, scales down with mipmapped linear filtering to fit 256 × 256 px, and encodes a
/// fresh PNG, so nothing of the upload's metadata survives.
/// </summary>
internal sealed class SkiaLogoImageProcessor : ILogoImageProcessor
{
    /// <summary>The media type of every stored logo.</summary>
    public const string OutputContentType = "image/png";

    private static readonly SKEncodedImageFormat[] AcceptedFormats = [SKEncodedImageFormat.Png, SKEncodedImageFormat.Jpeg, SKEncodedImageFormat.Webp];

    /// <inheritdoc />
    public LogoProcessingResult Process(ReadOnlySpan<byte> upload)
    {
        if (upload.IsEmpty)
        {
            return LogoProcessingResult.Failure(LogoUpload.UnsupportedImage());
        }

        using var data = SKData.CreateCopy(upload);
        using var codec = SKCodec.Create(data);
        if (codec is null || !AcceptedFormats.Contains(codec.EncodedFormat))
        {
            return LogoProcessingResult.Failure(LogoUpload.UnsupportedImage());
        }

        var size = codec.Info.Size;
        if ((long)size.Width * size.Height > LogoUpload.MaxMegapixels * 1_000_000L)
        {
            return LogoProcessingResult.Failure(LogoUpload.ImageTooLarge());
        }

        var origin = codec.EncodedOrigin;
        var target = FitIntoBox(Upright(size, origin));
        using var decoded = Decode(codec, DecodeSize(codec, origin, target));
        if (decoded is null)
        {
            return LogoProcessingResult.Failure(LogoUpload.UnsupportedImage());
        }

        return LogoProcessingResult.Success(TeamLogoImage.Create(Render(decoded, origin, target), OutputContentType, target.Width, target.Height));
    }

    /// <summary>The size of <paramref name="size"/> after turning it upright.</summary>
    internal static SKSizeI Upright(SKSizeI size, SKEncodedOrigin origin) =>
        SwapsSides(origin) ? new SKSizeI(size.Height, size.Width) : size;

    /// <summary>The size that fits into <see cref="TeamLogoImage.MaxSide"/> × <see cref="TeamLogoImage.MaxSide"/>, keeping the aspect ratio; never larger than <paramref name="size"/>.</summary>
    internal static SKSizeI FitIntoBox(SKSizeI size)
    {
        var scale = Math.Min(1.0, Math.Min((double)TeamLogoImage.MaxSide / size.Width, (double)TeamLogoImage.MaxSide / size.Height));
        return new SKSizeI(
            Math.Clamp((int)Math.Round(size.Width * scale), 1, TeamLogoImage.MaxSide),
            Math.Clamp((int)Math.Round(size.Height * scale), 1, TeamLogoImage.MaxSide));
    }

    /// <summary>The orientation matrix: maps the decoded pixels (stored orientation) to the upright image.</summary>
    internal static SKMatrix Orientation(SKEncodedOrigin origin, int width, int height) => origin switch
    {
        SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, width, 0, 1, 0, 0, 0, 1),
        SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, width, 0, -1, height, 0, 0, 1),
        SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, height, 0, 0, 1),
        SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightTop => new SKMatrix(0, -1, height, 1, 0, 0, 0, 0, 1),
        SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, height, -1, 0, width, 0, 0, 1),
        SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, width, 0, 0, 1),
        _ => SKMatrix.Identity,
    };

    private static bool SwapsSides(SKEncodedOrigin origin) =>
        origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;

    // Decoding a large photo at full size costs width × height × 4 bytes; JPEG and WebP decoders can
    // decode at a fraction of it. Twice the target size keeps the downscaling sharp.
    private static SKSizeI DecodeSize(SKCodec codec, SKEncodedOrigin origin, SKSizeI target)
    {
        var full = codec.Info.Size;
        var upright = Upright(full, origin);
        var wanted = (float)Math.Min(1.0, 2.0 * Math.Max((double)target.Width / upright.Width, (double)target.Height / upright.Height));
        var scaled = codec.GetScaledDimensions(wanted);
        var scaledUpright = Upright(scaled, origin);
        return scaledUpright.Width >= target.Width && scaledUpright.Height >= target.Height ? scaled : full;
    }

    private static SKBitmap? Decode(SKCodec codec, SKSizeI size)
    {
        var info = new SKImageInfo(size.Width, size.Height, SKColorType.Rgba8888, SKAlphaType.Premul, SKColorSpace.CreateSrgb());
        var bitmap = new SKBitmap(info);
        var result = codec.GetPixels(info, bitmap.GetPixels());
        if (result is SKCodecResult.Success or SKCodecResult.IncompleteInput)
        {
            return bitmap;
        }

        bitmap.Dispose();
        return null;
    }

    private static byte[] Render(SKBitmap decoded, SKEncodedOrigin origin, SKSizeI target)
    {
        var upright = Upright(new SKSizeI(decoded.Width, decoded.Height), origin);
        using var surface = SKSurface.Create(new SKImageInfo(target.Width, target.Height, SKColorType.Rgba8888, SKAlphaType.Premul))
            ?? throw new InvalidOperationException("Could not create a drawing surface.");
        var canvas = surface.Canvas;
        canvas.Clear(SKColors.Transparent);
        canvas.SetMatrix(
            SKMatrix.CreateScale((float)target.Width / upright.Width, (float)target.Height / upright.Height)
                .PreConcat(Orientation(origin, decoded.Width, decoded.Height)));
        using (var image = SKImage.FromBitmap(decoded))
        {
            canvas.DrawImage(image, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
        }

        canvas.Flush();
        using var snapshot = surface.Snapshot();
        using var png = snapshot.Encode(SKEncodedImageFormat.Png, 100)
            ?? throw new InvalidOperationException("Could not encode the logo as PNG.");
        return png.ToArray();
    }
}
