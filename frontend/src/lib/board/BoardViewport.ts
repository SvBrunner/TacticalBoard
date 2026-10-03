import type { Point } from "$lib/commands/Point";

/** Stage size in CSS pixels plus the uniform scale from scene units to CSS pixels. */
export interface StageFit {
	readonly width: number;
	readonly height: number;
	readonly scale: number;
}

/** An axis-aligned rectangle in viewport (client) CSS pixels. */
export interface ScreenRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * Maps the board scene (full-field units, origin top-left) onto the space
 * available on screen. The field is never rotated: it is scaled uniformly
 * as large as fits, so elements keep their proportions on every device.
 */
export class BoardViewport {
	/** Half of the 44 CSS px minimum touch target. */
	static readonly MIN_TOUCH_RADIUS_PX = 22;

	constructor(
		readonly sceneWidth = 2000,
		readonly sceneHeight = 1000,
	) {}

	/** Largest stage that fits into the container without changing the scene's aspect ratio. */
	fit(containerWidth: number, containerHeight: number): StageFit {
		if (!(containerWidth > 0) || !(containerHeight > 0)) {
			return { width: 0, height: 0, scale: 0 };
		}
		const scale = Math.min(containerWidth / this.sceneWidth, containerHeight / this.sceneHeight);
		return { width: this.sceneWidth * scale, height: this.sceneHeight * scale, scale };
	}

	/**
	 * Hit radius in scene units: the visual radius, enlarged so that the
	 * hit area is at least 44 CSS px across on screen.
	 */
	hitRadius(visualRadius: number, scale: number): number {
		if (!(scale > 0)) {
			return visualRadius;
		}
		return Math.max(visualRadius, BoardViewport.MIN_TOUCH_RADIUS_PX / scale);
	}

	/** Clamps a scene point onto the field, so elements can't be dragged off it. */
	clamp(point: Point): Point {
		return {
			x: Math.min(Math.max(point.x, 0), this.sceneWidth),
			y: Math.min(Math.max(point.y, 0), this.sceneHeight),
		};
	}

	/**
	 * On-screen bounds of a round element: `center` is its position in stage
	 * CSS pixels (already scaled), `origin` the stage container's top-left in
	 * viewport coordinates.
	 */
	screenRect(center: Point, visualRadius: number, scale: number, origin: Point): ScreenRect {
		const radius = visualRadius * scale;
		return {
			x: origin.x + center.x - radius,
			y: origin.y + center.y - radius,
			width: radius * 2,
			height: radius * 2,
		};
	}
}
