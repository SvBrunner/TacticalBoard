// Types for the parts of gifenc (https://github.com/mattdesl/gifenc, no bundled types) the app uses.
declare module "gifenc" {
	export type Palette = number[][];
	export type ColorFormat = "rgb565" | "rgb444" | "rgba4444";

	export interface WriteFrameOptions {
		palette?: Palette;
		/** Frame delay in milliseconds (stored in centiseconds). */
		delay?: number;
		/** -1 = play once, 0 = loop forever, > 0 = repeat count; written with the first frame. */
		repeat?: number;
		transparent?: boolean;
		transparentIndex?: number;
		colorDepth?: number;
		dispose?: number;
		first?: boolean;
	}

	export interface Encoder {
		writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void;
		finish(): void;
		bytes(): Uint8Array;
		bytesView(): Uint8Array;
		reset(): void;
	}

	export function GIFEncoder(options?: { initialCapacity?: number; auto?: boolean }): Encoder;
	export function quantize(
		rgba: Uint8Array | Uint8ClampedArray,
		maxColors: number,
		options?: { format?: ColorFormat; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
	): Palette;
	export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: ColorFormat): Uint8Array;
}
