using System.Buffers.Binary;
using System.Text;
using SkiaSharp;

namespace TacticalBoard.UnitTests.TestSupport;

/// <summary>Builds images for the logo tests: encoded with Skia, plus metadata injected byte by byte.</summary>
internal static class TestImages
{
    public static readonly SKColor Left = new(220, 30, 30);
    public static readonly SKColor Right = new(30, 30, 220);

    /// <summary>An image whose left half is <see cref="Left"/> and right half <see cref="Right"/>.</summary>
    public static byte[] Halves(int width, int height, SKEncodedImageFormat format, int quality = 95)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(width, height, SKColorType.Rgba8888, SKAlphaType.Premul));
        using (var canvas = new SKCanvas(bitmap))
        {
            using var left = new SKPaint { Color = Left };
            using var right = new SKPaint { Color = Right };
            canvas.DrawRect(0, 0, width / 2f, height, left);
            canvas.DrawRect(width / 2f, 0, width - (width / 2f), height, right);
        }

        return Encode(bitmap, format, quality);
    }

    /// <summary>A fully transparent image with an opaque square in the middle.</summary>
    public static byte[] TransparentWithSquare(int size)
    {
        using var bitmap = new SKBitmap(new SKImageInfo(size, size, SKColorType.Rgba8888, SKAlphaType.Premul));
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.Transparent);
            using var paint = new SKPaint { Color = Left };
            canvas.DrawRect(size / 4f, size / 4f, size / 2f, size / 2f, paint);
        }

        return Encode(bitmap, SKEncodedImageFormat.Png, 100);
    }

    public static byte[] Encode(SKBitmap bitmap, SKEncodedImageFormat format, int quality)
    {
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, quality);
        return data.ToArray();
    }

    /// <summary>The decoded pixels.</summary>
    public static SKBitmap Decode(byte[] data) => SKBitmap.Decode(data) ?? throw new ArgumentException("Not an image.", nameof(data));

    /// <summary><paramref name="jpeg"/> with an EXIF segment (APP1) carrying the camera make and an orientation.</summary>
    public static byte[] WithJpegExif(byte[] jpeg, ushort orientation, string make)
    {
        var makeBytes = Encoding.ASCII.GetBytes(make + "\0");
        var tiff = new List<byte>();
        tiff.AddRange("MM"u8.ToArray());
        tiff.AddRange(BigEndian16(42));
        tiff.AddRange(BigEndian32(8));
        tiff.AddRange(BigEndian16(2)); // entries
        // Make (ASCII), its text after the directory.
        tiff.AddRange(BigEndian16(0x010F));
        tiff.AddRange(BigEndian16(2));
        tiff.AddRange(BigEndian32((uint)makeBytes.Length));
        tiff.AddRange(BigEndian32(8 + 2 + (2 * 12) + 4));
        // Orientation (SHORT), the value inline.
        tiff.AddRange(BigEndian16(0x0112));
        tiff.AddRange(BigEndian16(3));
        tiff.AddRange(BigEndian32(1));
        tiff.AddRange(BigEndian16(orientation));
        tiff.AddRange(BigEndian16(0));
        tiff.AddRange(BigEndian32(0)); // no next directory
        tiff.AddRange(makeBytes);

        var payload = "Exif\0\0"u8.ToArray().Concat(tiff).ToArray();
        var segment = new List<byte> { 0xFF, 0xE1 };
        segment.AddRange(BigEndian16((ushort)(payload.Length + 2)));
        segment.AddRange(payload);
        // Right after the start-of-image marker (FF D8).
        return jpeg.Take(2).Concat(segment).Concat(jpeg.Skip(2)).ToArray();
    }

    /// <summary><paramref name="png"/> with a <c>tEXt</c> chunk right after the header chunk.</summary>
    public static byte[] WithPngText(byte[] png, string keyword, string text)
    {
        var data = Encoding.Latin1.GetBytes(keyword + "\0" + text);
        var type = "tEXt"u8.ToArray();
        var chunk = new List<byte>();
        chunk.AddRange(BigEndian32((uint)data.Length));
        chunk.AddRange(type);
        chunk.AddRange(data);
        chunk.AddRange(BigEndian32(Crc32(type.Concat(data).ToArray())));
        const int afterHeader = 8 + 4 + 4 + 13 + 4; // signature + IHDR chunk
        return png.Take(afterHeader).Concat(chunk).Concat(png.Skip(afterHeader)).ToArray();
    }

    /// <summary>The chunk types of a PNG, in order.</summary>
    public static List<string> PngChunkTypes(byte[] png)
    {
        var types = new List<string>();
        var position = 8;
        while (position + 8 <= png.Length)
        {
            var length = (int)BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(position));
            types.Add(Encoding.ASCII.GetString(png, position + 4, 4));
            position += 12 + length;
        }

        return types;
    }

    /// <summary>Whether <paramref name="data"/> starts with the PNG signature.</summary>
    public static bool IsPng(byte[] data) => data.AsSpan().StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });

    private static byte[] BigEndian16(ushort value)
    {
        var bytes = new byte[2];
        BinaryPrimitives.WriteUInt16BigEndian(bytes, value);
        return bytes;
    }

    private static byte[] BigEndian32(uint value)
    {
        var bytes = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(bytes, value);
        return bytes;
    }

    private static uint Crc32(byte[] data)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in data)
        {
            crc ^= b;
            for (var bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }

        return ~crc;
    }
}
