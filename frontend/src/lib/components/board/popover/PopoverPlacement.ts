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
	readonly side: "below" | "above" | "right" | "left";
}

/**
 * Positions a popover next to an anchor rect without covering it, always
 * inside the viewport (minus a margin): below it, horizontally centered;
 * flipped above when there is no room below; to its right (or left),
 * vertically centered, when it fits neither below nor above (e.g. a tall
 * popover next to a large arrow). Only when it fits on no side does it use
 * the roomier of below/above and may overlap the anchor.
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
		if (below + popover.height <= viewport.height - this.margin) {
			return { x, y: below, side: "below" };
		}
		if (above >= this.margin) {
			return { x, y: above, side: "above" };
		}

		const y = this.clamp(anchor.y + anchor.height / 2 - popover.height / 2, popover.height, viewport.height);
		const right = anchor.x + anchor.width + this.gap;
		const left = anchor.x - this.gap - popover.width;
		if (right + popover.width <= viewport.width - this.margin) {
			return { x: right, y, side: "right" };
		}
		if (left >= this.margin) {
			return { x: left, y, side: "left" };
		}

		// Fits on no side: use the roomier of below/above and keep it on screen.
		const roomBelow = viewport.height - (anchor.y + anchor.height);
		const side = roomBelow >= anchor.y ? "below" : "above";
		return { x, y: this.clamp(side === "below" ? below : above, popover.height, viewport.height), side };
	}

	private clamp(start: number, size: number, available: number): number {
		const max = available - size - this.margin;
		return Math.max(this.margin, Math.min(start, max));
	}
}
