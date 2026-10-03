import type { ScreenRect } from "$lib/board/BoardViewport";

export interface Extent {
	readonly width: number;
	readonly height: number;
}

export interface Placement {
	/** Left edge in viewport CSS px. */
	readonly x: number;
	/** Top edge in viewport CSS px. */
	readonly y: number;
	readonly side: "below" | "above";
}

/**
 * Positions a popover next to an anchor rect: horizontally centered on it
 * and below it, flipped above when there is no room below, and always kept
 * inside the viewport (minus a margin).
 */
export class PopoverPlacement {
	constructor(
		private readonly gap = 8,
		private readonly margin = 8,
	) {}

	place(anchor: ScreenRect, popover: Extent, viewport: Extent): Placement {
		const x = this.clamp(anchor.x + anchor.width / 2 - popover.width / 2, popover.width, viewport.width);

		const below = anchor.y + anchor.height + this.gap;
		const above = anchor.y - this.gap - popover.height;
		const fitsBelow = below + popover.height <= viewport.height - this.margin;
		const fitsAbove = above >= this.margin;

		if (fitsBelow) {
			return { x, y: below, side: "below" };
		}
		if (fitsAbove) {
			return { x, y: above, side: "above" };
		}
		// Fits on neither side: use the roomier side and keep it on screen.
		const roomBelow = viewport.height - (anchor.y + anchor.height);
		const side = roomBelow >= anchor.y ? "below" : "above";
		return { x, y: this.clamp(side === "below" ? below : above, popover.height, viewport.height), side };
	}

	private clamp(start: number, size: number, available: number): number {
		const max = available - size - this.margin;
		return Math.max(this.margin, Math.min(start, max));
	}
}
