/** One rendered picture: RGBA pixels, row by row (like `ImageData`). */
export interface RasterImage {
	readonly width: number;
	readonly height: number;
	readonly data: Uint8ClampedArray;
}

/**
 * Turns a sequence of pictures into one animation file. Every picture
 * must have the size of the first one.
 */
export interface AnimationEncoder {
	/** Media type of the produced file, e.g. `image/gif`. */
	readonly mimeType: string;
	/** File name extension including the dot, e.g. `.gif`. */
	readonly fileExtension: string;
	/** Appends a picture shown for `durationMs`. */
	addFrame(image: RasterImage, durationMs: number): void;
	/** Ends the animation and returns the file. The encoder can't be used afterwards. */
	finish(): Blob;
}

/** Creates a fresh encoder (possibly loading its code first). */
export type AnimationEncoderFactory = () => Promise<AnimationEncoder>;
