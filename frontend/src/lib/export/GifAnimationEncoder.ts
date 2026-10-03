import type { AnimationEncoder, RasterImage } from "./AnimationEncoder";

/** The gifenc functions the encoder uses. */
export type GifencModule = Pick<typeof import("gifenc"), "GIFEncoder" | "quantize" | "applyPalette">;

/** Loads gifenc on demand, so it lives in its own chunk instead of the editor's bundle. */
const loadGifenc = (): Promise<GifencModule> => import("gifenc");

/**
 * Encodes an animated GIF with gifenc: one GIF frame per picture, delayed
 * by the picture's duration, looping forever.
 *
 * Every frame gets its own 256-color palette (quantized from that frame,
 * RGB565), stored as a local color table: frames are hard cuts, so a
 * per-frame palette keeps each frame's colors exact without dithering
 * noise, at the cost of 768 bytes per frame. Pictures are opaque (the
 * field has no transparent parts), so no transparency is written.
 */
export class GifAnimationEncoder implements AnimationEncoder {
	static readonly MIME_TYPE = "image/gif";
	static readonly FILE_EXTENSION = ".gif";
	/** GIF stores delays in hundredths of a second, at most 65535. */
	static readonly MAX_DELAY_MS = 655_350;

	readonly mimeType = GifAnimationEncoder.MIME_TYPE;
	readonly fileExtension = GifAnimationEncoder.FILE_EXTENSION;

	private readonly gif;
	private size: { width: number; height: number } | null = null;
	private finished = false;

	constructor(private readonly gifenc: GifencModule) {
		this.gif = gifenc.GIFEncoder();
	}

	/** An encoder with gifenc loaded (lazily, on first use). */
	static async create(load: () => Promise<GifencModule> = loadGifenc): Promise<GifAnimationEncoder> {
		return new GifAnimationEncoder(await load());
	}

	addFrame(image: RasterImage, durationMs: number): void {
		this.assertOpen();
		this.assertSize(image);
		if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > GifAnimationEncoder.MAX_DELAY_MS) {
			throw new Error(`Unsupported frame duration for a GIF: ${durationMs} ms`);
		}
		const palette = this.gifenc.quantize(image.data, 256, { format: "rgb565" });
		const index = this.gifenc.applyPalette(image.data, palette, "rgb565");
		this.gif.writeFrame(index, image.width, image.height, { palette, delay: durationMs, repeat: 0 });
	}

	finish(): Blob {
		this.assertOpen();
		if (!this.size) {
			throw new Error("A GIF needs at least one frame");
		}
		this.finished = true;
		this.gif.finish();
		// Copy: `bytes()` would be a view onto gifenc's growing buffer.
		return new Blob([this.gif.bytes().slice()], { type: this.mimeType });
	}

	private assertOpen(): void {
		if (this.finished) {
			throw new Error("The GIF is already finished");
		}
	}

	private assertSize(image: RasterImage): void {
		if (!(image.width > 0) || !(image.height > 0) || image.data.length !== image.width * image.height * 4) {
			throw new Error(`Invalid picture: ${image.width} × ${image.height} with ${image.data.length} bytes`);
		}
		if (!this.size) {
			this.size = { width: image.width, height: image.height };
		} else if (this.size.width !== image.width || this.size.height !== image.height) {
			throw new Error(
				`Every frame must be ${this.size.width} × ${this.size.height} px (got ${image.width} × ${image.height})`,
			);
		}
	}
}
