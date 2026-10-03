/**
 * Picks a readable text color (black or white) for a label drawn on a filled
 * shape. Uses the WCAG relative luminance of the fill: dark text when it
 * gives at least as much contrast as white text, i.e. luminance ≥ ~0.179.
 *
 * Understands `oklch(...)` (the app's own colors; its lightness L is the
 * cube root of the luminance for neutral colors, which is close enough for
 * this decision), `#rgb`/`#rrggbb` hex and `rgb()`/`rgba()`. Any other
 * color (e.g. a named color from a hand-edited file) gets the fallback.
 */
export class LabelContrast {
	static readonly DARK = "black";
	static readonly LIGHT = "white";

	/** Luminance at which black and white text have the same WCAG contrast ratio. */
	private static readonly LUMINANCE_THRESHOLD = Math.sqrt(1.05 * 0.05) - 0.05;

	constructor(private readonly fallback: string = LabelContrast.DARK) {}

	textColorFor(fill: string): string {
		const luminance = LabelContrast.luminanceOf(fill.trim().toLowerCase());
		if (luminance === undefined) {
			return this.fallback;
		}
		return luminance >= LabelContrast.LUMINANCE_THRESHOLD ? LabelContrast.DARK : LabelContrast.LIGHT;
	}

	private static luminanceOf(color: string): number | undefined {
		return LabelContrast.oklchLuminance(color) ?? LabelContrast.hexLuminance(color) ?? LabelContrast.rgbLuminance(color);
	}

	private static oklchLuminance(color: string): number | undefined {
		const match = /^oklch\(\s*([\d.]+)(%?)[\s,]/.exec(color);
		if (!match) {
			return undefined;
		}
		const value = Number(match[1]);
		if (!Number.isFinite(value)) {
			return undefined;
		}
		const lightness = Math.min(Math.max(match[2] === "%" ? value / 100 : value, 0), 1);
		return lightness ** 3;
	}

	private static hexLuminance(color: string): number | undefined {
		const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(color);
		if (!match) {
			return undefined;
		}
		const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
		const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16));
		return LabelContrast.srgbLuminance(channels);
	}

	private static rgbLuminance(color: string): number | undefined {
		const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(color);
		if (!match) {
			return undefined;
		}
		const channels = [match[1], match[2], match[3]].map(Number);
		return channels.every(Number.isFinite) ? LabelContrast.srgbLuminance(channels) : undefined;
	}

	/** WCAG relative luminance of 8-bit sRGB channels. */
	private static srgbLuminance([r, g, b]: number[]): number {
		const linear = (channel: number) => {
			const c = Math.min(Math.max(channel, 0), 255) / 255;
			return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
		};
		return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
	}
}

export const labelContrast = new LabelContrast();
