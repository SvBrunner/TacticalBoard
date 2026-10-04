/** A size in pixels (or in any unit, for aspect ratios). */
export interface PixelSize {
	readonly width: number;
	readonly height: number;
}

export type ExportResolutionId = "small" | "medium" | "large";

/**
 * A size preset for exported animations, given by the length of the
 * picture's long side. The other side follows the shown field's aspect
 * ratio (full field: landscape; half field: portrait, or square for
 * floorball's half), so the field is never distorted or letterboxed.
 */
export class ExportResolution {
	static readonly SMALL = new ExportResolution("small", 600);
	static readonly MEDIUM = new ExportResolution("medium", 1200);
	static readonly LARGE = new ExportResolution("large", 1800);

	/** All presets, smallest first. */
	static readonly ALL: readonly ExportResolution[] = [ExportResolution.SMALL, ExportResolution.MEDIUM, ExportResolution.LARGE];
	static readonly DEFAULT = ExportResolution.MEDIUM;

	private constructor(
		/** Also the key of its name in the message catalog (`exportGif.resolutions`). */
		readonly id: ExportResolutionId,
		/** Length of the long side in pixels. */
		readonly longSide: number,
	) {}

	/** The preset with that id; throws for unknown ids. */
	static byId(id: string): ExportResolution {
		const found = ExportResolution.ALL.find((resolution) => resolution.id === id);
		if (!found) {
			throw new Error(`Unknown export resolution: ${id}`);
		}
		return found;
	}

	/**
	 * Whole-pixel size for content of the given aspect ratio (e.g. the
	 * viewport's `contentSize`): the long side is `longSide`, the short
	 * side is scaled and rounded (at least 1 px).
	 */
	sizeFor(content: PixelSize): PixelSize {
		const { width, height } = content;
		if (!(width > 0) || !(height > 0)) {
			throw new Error(`Content size must be positive (got ${width} × ${height})`);
		}
		const shortSide = (long: number, short: number) => Math.max(1, Math.round((this.longSide * short) / long));
		return width >= height
			? { width: this.longSide, height: shortSide(width, height) }
			: { width: shortSide(height, width), height: this.longSide };
	}
}
