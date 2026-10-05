using System.Text;
using SkiaSharp;
using TacticalBoard.Teams.Application;
using TacticalBoard.Teams.Infrastructure;
using TacticalBoard.UnitTests.TestSupport;

namespace TacticalBoard.UnitTests.Teams;

public class SkiaLogoImageProcessorTests
{
    private readonly SkiaLogoImageProcessor _processor = new();

    private (byte[] Png, SKBitmap Pixels) ProcessSuccessfully(byte[] upload)
    {
        var result = _processor.Process(upload);
        Assert.Null(result.Error);
        var logo = Assert.IsType<TacticalBoard.Teams.Domain.TeamLogoImage>(result.Logo);
        var png = logo.Content.ToArray();
        Assert.True(TestImages.IsPng(png));
        Assert.Equal("image/png", logo.ContentType);
        var pixels = TestImages.Decode(png);
        Assert.Equal((pixels.Width, pixels.Height), (logo.Width, logo.Height));
        return (png, pixels);
    }

    private static void AssertClose(SKColor expected, SKColor actual, int tolerance = 40)
    {
        Assert.True(
            Math.Abs(expected.Red - actual.Red) <= tolerance && Math.Abs(expected.Green - actual.Green) <= tolerance && Math.Abs(expected.Blue - actual.Blue) <= tolerance,
            $"Expected about {expected}, got {actual}.");
    }

    [Theory]
    [InlineData(SKEncodedImageFormat.Png)]
    [InlineData(SKEncodedImageFormat.Jpeg)]
    [InlineData(SKEncodedImageFormat.Webp)]
    public void Accepts_png_jpeg_and_webp_and_stores_png(SKEncodedImageFormat format)
    {
        var (_, pixels) = ProcessSuccessfully(TestImages.Halves(100, 60, format));

        Assert.Equal((100, 60), (pixels.Width, pixels.Height));
        AssertClose(TestImages.Left, pixels.GetPixel(10, 30));
        AssertClose(TestImages.Right, pixels.GetPixel(90, 30));
    }

    [Theory]
    [InlineData(1024, 512, 256, 128)]
    [InlineData(512, 1024, 128, 256)]
    [InlineData(1000, 1000, 256, 256)]
    [InlineData(300, 257, 256, 219)]
    [InlineData(4000, 3000, 256, 192)]
    public void Scales_down_to_fit_256_px_keeping_the_aspect_ratio(int width, int height, int expectedWidth, int expectedHeight)
    {
        var (_, pixels) = ProcessSuccessfully(TestImages.Halves(width, height, SKEncodedImageFormat.Jpeg, 90));

        Assert.Equal((expectedWidth, expectedHeight), (pixels.Width, pixels.Height));
        AssertClose(TestImages.Left, pixels.GetPixel(expectedWidth / 8, expectedHeight / 2));
        AssertClose(TestImages.Right, pixels.GetPixel(expectedWidth * 7 / 8, expectedHeight / 2));
    }

    [Fact]
    public void Never_scales_up()
    {
        var (_, pixels) = ProcessSuccessfully(TestImages.Halves(32, 16, SKEncodedImageFormat.Png));

        Assert.Equal((32, 16), (pixels.Width, pixels.Height));
    }

    [Fact]
    public void Keeps_transparency()
    {
        var (_, pixels) = ProcessSuccessfully(TestImages.TransparentWithSquare(512));

        Assert.Equal((256, 256), (pixels.Width, pixels.Height));
        Assert.Equal(0, pixels.GetPixel(5, 5).Alpha);
        Assert.Equal(255, pixels.GetPixel(128, 128).Alpha);
    }

    [Fact]
    public void Drops_the_exif_metadata_of_a_jpeg()
    {
        var upload = TestImages.WithJpegExif(TestImages.Halves(64, 64, SKEncodedImageFormat.Jpeg), orientation: 1, make: "SecretCam 3000");
        Assert.Contains("SecretCam", Encoding.Latin1.GetString(upload), StringComparison.Ordinal);

        var (png, _) = ProcessSuccessfully(upload);

        Assert.DoesNotContain("SecretCam", Encoding.Latin1.GetString(png), StringComparison.Ordinal);
        Assert.DoesNotContain("Exif", Encoding.Latin1.GetString(png), StringComparison.Ordinal);
        Assert.DoesNotContain("eXIf", TestImages.PngChunkTypes(png));
    }

    [Fact]
    public void Drops_the_text_chunks_of_a_png()
    {
        var upload = TestImages.WithPngText(TestImages.Halves(64, 64, SKEncodedImageFormat.Png), "Author", "Jane Secret");
        Assert.Contains("tEXt", TestImages.PngChunkTypes(upload));

        var (png, _) = ProcessSuccessfully(upload);

        Assert.DoesNotContain("Jane Secret", Encoding.Latin1.GetString(png), StringComparison.Ordinal);
        Assert.Empty(TestImages.PngChunkTypes(png).Intersect(["tEXt", "zTXt", "iTXt", "eXIf", "tIME", "iCCP"]));
    }

    [Fact]
    public void Turns_a_photo_upright_by_its_exif_orientation()
    {
        // Stored landscape (left red, right blue), to be shown rotated 90° clockwise (orientation 6):
        // portrait, red at the top.
        var upload = TestImages.WithJpegExif(TestImages.Halves(400, 200, SKEncodedImageFormat.Jpeg), orientation: 6, make: "Phone");

        var (_, pixels) = ProcessSuccessfully(upload);

        Assert.Equal((128, 256), (pixels.Width, pixels.Height));
        AssertClose(TestImages.Left, pixels.GetPixel(64, 20));
        AssertClose(TestImages.Right, pixels.GetPixel(64, 236));
    }

    [Theory]
    [InlineData("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\"/></svg>")]
    [InlineData("not an image at all")]
    public void Rejects_svg_and_other_non_images(string content)
    {
        var result = _processor.Process(Encoding.UTF8.GetBytes(content));

        Assert.Null(result.Logo);
        Assert.Equal("unsupported-image", result.Error!.Code);
    }

    [Fact]
    public void Rejects_an_empty_file_and_a_truncated_header()
    {
        Assert.Equal("unsupported-image", _processor.Process([]).Error!.Code);
        Assert.Equal("unsupported-image", _processor.Process(TestImages.Halves(10, 10, SKEncodedImageFormat.Png).AsSpan(0, 20)).Error!.Code);
    }

    [Fact]
    public void Rejects_gif()
    {
        // A minimal 1 × 1 GIF.
        byte[] gif = Convert.FromBase64String("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

        Assert.Equal("unsupported-image", _processor.Process(gif).Error!.Code);
    }

    [Fact]
    public void Rejects_an_image_with_more_than_25_megapixels_before_decoding_it()
    {
        // A PNG header claiming 6000 × 5000 px (30 megapixels): rejected from the header alone.
        var png = TestImages.Halves(10, 10, SKEncodedImageFormat.Png);
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(16), 6000);
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(20), 5000);
        FixIhdrCrc(png);

        var result = _processor.Process(png);

        Assert.Equal("image-too-large", result.Error!.Code);
        Assert.Equal(LogoUpload.MaxMegapixels, result.Error.Values["maxMegapixels"]);
    }

    [Fact]
    public void A_damaged_body_with_a_valid_header_is_still_turned_into_an_image_or_rejected_but_never_throws()
    {
        var png = TestImages.Halves(64, 64, SKEncodedImageFormat.Png);
        var damaged = png.Take(png.Length / 2).ToArray();

        var result = _processor.Process(damaged);

        Assert.True(result.Logo is not null || result.Error!.Code == "unsupported-image");
    }

    [Theory]
    [InlineData(SKEncodedOrigin.TopLeft, 40, 20)]
    [InlineData(SKEncodedOrigin.TopRight, 40, 20)]
    [InlineData(SKEncodedOrigin.BottomRight, 40, 20)]
    [InlineData(SKEncodedOrigin.BottomLeft, 40, 20)]
    [InlineData(SKEncodedOrigin.LeftTop, 20, 40)]
    [InlineData(SKEncodedOrigin.RightTop, 20, 40)]
    [InlineData(SKEncodedOrigin.RightBottom, 20, 40)]
    [InlineData(SKEncodedOrigin.LeftBottom, 20, 40)]
    public void Every_orientation_maps_the_stored_image_onto_the_upright_one(SKEncodedOrigin origin, int uprightWidth, int uprightHeight)
    {
        Assert.Equal(new SKSizeI(uprightWidth, uprightHeight), SkiaLogoImageProcessor.Upright(new SKSizeI(40, 20), origin));
        var matrix = SkiaLogoImageProcessor.Orientation(origin, 40, 20);

        // The four corners of the stored 40 × 20 image land on the four corners of the upright one.
        var corners = new[] { new SKPoint(0, 0), new SKPoint(40, 0), new SKPoint(0, 20), new SKPoint(40, 20) }
            .Select(matrix.MapPoint)
            .Select(point => (point.X, point.Y))
            .OrderBy(point => point)
            .ToList();
        Assert.Equal([(0f, 0f), (0f, uprightHeight), (uprightWidth, 0f), (uprightWidth, uprightHeight)], corners);
    }

    [Fact]
    public void Rotating_clockwise_puts_the_stored_left_edge_at_the_top()
    {
        var matrix = SkiaLogoImageProcessor.Orientation(SKEncodedOrigin.RightTop, 40, 20);

        // A point near the stored left edge, vertically centered.
        var point = matrix.MapPoint(new SKPoint(1, 10));

        Assert.Equal((10f, 1f), (point.X, point.Y));
    }

    [Theory]
    [InlineData(10, 10, 10, 10)]
    [InlineData(256, 256, 256, 256)]
    [InlineData(10000, 1, 256, 1)]
    [InlineData(1, 10000, 1, 256)]
    public void Fits_into_the_box_and_never_below_one_pixel(int width, int height, int expectedWidth, int expectedHeight)
    {
        Assert.Equal(new SKSizeI(expectedWidth, expectedHeight), SkiaLogoImageProcessor.FitIntoBox(new SKSizeI(width, height)));
    }

    private static void FixIhdrCrc(byte[] png)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in png.AsSpan(12, 17))
        {
            crc ^= b;
            for (var bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }

        System.Buffers.Binary.BinaryPrimitives.WriteUInt32BigEndian(png.AsSpan(29), ~crc);
    }
}
