import type { Point } from "$lib/model/Point";
import { FieldDimensions, type SceneRect } from "$lib/model/FieldDimensions";
import type { FieldType } from "$lib/model/FieldType";
import type { SportId } from "$lib/model/Sport";

/** Stage rotation in degrees (clockwise on screen). */
export type StageRotation = 0 | 90;

/**
 * How the Konva stage is laid out: its size in CSS pixels, the uniform scale
 * from scene units to CSS pixels, its rotation, and its position (the stage
 * offset that brings the visible part of the scene to the stage's top-left).
 * The fields map 1:1 onto the Stage's flat props.
 */
export interface StageFit {
	readonly width: number;
	readonly height: number;
	readonly scale: number;
	readonly rotation: StageRotation;
	readonly x: number;
	readonly y: number;
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
 * available on screen. The visible part of the field is scaled uniformly as
 * large as fits, so elements keep their proportions on every device.
 *
 * - Full field: the whole field, landscape, never rotated.
 * - Half field: only the half-field rect (see `FieldDimensions`), shown in
 *   portrait: the stage is rotated 90° clockwise, which puts that half's
 *   goal (the right end of the full field) at the bottom of the screen.
 *   The whole field is still drawn; everything outside the visible rect is
 *   simply cropped by the stage's size.
 *
 * "Stage coordinates" below are CSS pixels relative to the stage
 * container's top-left corner.
 */
export class BoardViewport {
	/** Half of the 44 CSS px minimum touch target. */
	static readonly MIN_TOUCH_RADIUS_PX = 22;

	/** The part of the field that is shown, in scene units. */
	readonly visibleRect: SceneRect;
	readonly rotation: StageRotation;

	constructor(
		readonly field: FieldDimensions = FieldDimensions.FLOORBALL,
		readonly fieldType: FieldType = "full",
	) {
		this.visibleRect = field.visibleRect(fieldType);
		this.rotation = fieldType === "half" ? 90 : 0;
	}

	static forSituation(situation: { readonly sport: SportId; readonly fieldType: FieldType }): BoardViewport {
		return new BoardViewport(FieldDimensions.forSport(situation.sport), situation.fieldType);
	}

	/** Largest stage that fits into the container without changing the visible rect's aspect ratio. */
	/**
	 * Size of the visible rect as it appears on screen, in scene units:
	 * width and height swap for the rotated (half-field) view.
	 */
	get contentSize(): { readonly width: number; readonly height: number } {
		const rect = this.visibleRect;
		return this.rotation === 90 ? { width: rect.height, height: rect.width } : { width: rect.width, height: rect.height };
	}

	fit(containerWidth: number, containerHeight: number): StageFit {
		const rect = this.visibleRect;
		const rotated = this.rotation === 90;
		const { width: contentWidth, height: contentHeight } = this.contentSize;
		if (!(containerWidth > 0) || !(containerHeight > 0)) {
			return { width: 0, height: 0, scale: 0, rotation: this.rotation, x: 0, y: 0 };
		}
		const scale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight);
		// Rotation 90° maps scene (x, y) to (-y, x) before translation.
		// (`0 - …` instead of a unary minus avoids -0.)
		const x = rotated ? scale * (rect.y + rect.height) : 0 - scale * rect.x;
		const y = rotated ? 0 - scale * rect.x : 0 - scale * rect.y;
		return { width: contentWidth * scale, height: contentHeight * scale, scale, rotation: this.rotation, x, y };
	}

	/** Scene point → stage coordinates, for the given fit. */
	sceneToStage(point: Point, fit: StageFit): Point {
		const sx = point.x * fit.scale;
		const sy = point.y * fit.scale;
		return fit.rotation === 90 ? { x: fit.x - sy, y: fit.y + sx } : { x: fit.x + sx, y: fit.y + sy };
	}

	/** Stage coordinates → scene point, for the given fit (inverse of `sceneToStage`). */
	stageToScene(point: Point, fit: StageFit): Point {
		if (!(fit.scale > 0)) {
			return { x: 0, y: 0 };
		}
		const dx = point.x - fit.x;
		const dy = point.y - fit.y;
		return fit.rotation === 90
			? { x: dy / fit.scale, y: -dx / fit.scale }
			: { x: dx / fit.scale, y: dy / fit.scale };
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

	/**
	 * Clamps a scene point into the visible area (the whole field, or the
	 * visible half), so elements can't be placed or dragged where they
	 * can't be seen.
	 */
	clamp(point: Point): Point {
		const rect = this.visibleRect;
		return {
			x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
			y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height),
		};
	}

	/**
	 * On-screen bounds of a round element at scene position `center`;
	 * `origin` is the stage container's top-left in viewport coordinates.
	 * Round elements look the same rotated, so the rect is axis-aligned.
	 */
	/**
	 * On-screen bounds of a scene rect (e.g. an arrow's bounds); `origin`
	 * is the stage container's top-left in viewport coordinates. Works
	 * rotated: the result is the axis-aligned box around the mapped corners.
	 */
	screenRectOfBounds(bounds: SceneRect, fit: StageFit, origin: Point): ScreenRect {
		const corners = [
			{ x: bounds.x, y: bounds.y },
			{ x: bounds.x + bounds.width, y: bounds.y },
			{ x: bounds.x, y: bounds.y + bounds.height },
			{ x: bounds.x + bounds.width, y: bounds.y + bounds.height },
		].map((corner) => this.sceneToStage(corner, fit));
		const xs = corners.map((corner) => corner.x);
		const ys = corners.map((corner) => corner.y);
		const left = Math.min(...xs);
		const top = Math.min(...ys);
		return { x: origin.x + left, y: origin.y + top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
	}

	screenRect(center: Point, visualRadius: number, fit: StageFit, origin: Point): ScreenRect {
		const onStage = this.sceneToStage(center, fit);
		const radius = visualRadius * fit.scale;
		return {
			x: origin.x + onStage.x - radius,
			y: origin.y + onStage.y - radius,
			width: radius * 2,
			height: radius * 2,
		};
	}
}
