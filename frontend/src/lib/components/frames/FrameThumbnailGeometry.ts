import type { BoardViewport } from "$lib/board/BoardViewport";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { PointElementType } from "$lib/model/elements/ElementType";
import { PointElement } from "$lib/model/elements/PointElement";
import type { Frame } from "$lib/model/Frame";
import { visualRadius } from "../board/Shapes";

/** A rectangle in scene units. */
export interface SketchRect {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/** Simplified floorball field markings in full-field scene units (same proportions as the board's background). */
export interface FieldSketch {
	readonly rink: SketchRect & { readonly cornerRadius: number };
	readonly centerLine: { readonly x: number; readonly y1: number; readonly y2: number };
	readonly goalAreas: readonly SketchRect[];
	/** Open goal brackets as SVG path data. */
	readonly goals: readonly string[];
}

/** One element as drawn in a thumbnail, in thumbnail (on-screen) units. */
export interface ThumbnailMark {
	readonly id: string;
	readonly type: PointElementType;
	readonly color: string;
	readonly x: number;
	readonly y: number;
	/** Drawing radius (thumbnail units), already enlarged so it stays visible at thumbnail size. */
	readonly radius: number;
}

/**
 * Geometry of a small static SVG preview of a frame, for the frame strip.
 * It follows the board's viewport: the full field landscape, the half
 * field rotated to portrait with its goal at the bottom (only the visible
 * half is shown; everything else is cropped by the viewBox).
 *
 * Thumbnail units are scene units laid out as on screen (no scaling), so
 * the viewBox is the viewport's `contentSize`; the field is drawn in scene
 * coordinates inside `fieldTransform`, and elements are mapped to thumbnail
 * units directly. Elements are drawn `ELEMENT_ENLARGEMENT` times their board
 * size, otherwise they'd be a pixel wide.
 */
export class FrameThumbnailGeometry {
	static readonly ELEMENT_ENLARGEMENT = 2.5;

	constructor(readonly viewport: BoardViewport) {}

	get width(): number {
		return this.viewport.contentSize.width;
	}

	get height(): number {
		return this.viewport.contentSize.height;
	}

	get viewBox(): string {
		return `0 0 ${this.width} ${this.height}`;
	}

	/** SVG transform from scene coordinates to thumbnail units. */
	get fieldTransform(): string {
		const fit = this.fit();
		return `translate(${fit.x} ${fit.y}) rotate(${fit.rotation})`;
	}

	get field(): FieldSketch {
		const { width, height } = this.viewport.field;
		// Proportions as in the board background (Lines, GoalArea, Goal).
		const areaDepth = width * 0.112;
		const areaHeight = height * 0.333;
		const areaInset = width * 0.05;
		const goalMouth = width * 0.0987;
		const goalDepth = width * 0.02;
		const goalHalfWidth = (height * 0.167) / 2;
		const goal = (mouthX: number, direction: 1 | -1) => {
			const back = mouthX - direction * goalDepth;
			const top = height / 2 - goalHalfWidth;
			const bottom = height / 2 + goalHalfWidth;
			return `M ${mouthX} ${top} L ${back} ${top} L ${back} ${bottom} L ${mouthX} ${bottom}`;
		};
		return {
			rink: { x: 0, y: 0, width, height, cornerRadius: 100 },
			centerLine: { x: width / 2, y1: 0, y2: height },
			goalAreas: [
				{ x: areaInset, y: height / 2 - areaHeight / 2, width: areaDepth, height: areaHeight },
				{ x: width - areaDepth - areaInset, y: height / 2 - areaHeight / 2, width: areaDepth, height: areaHeight },
			],
			goals: [goal(goalMouth, 1), goal(width - goalMouth, -1)],
		};
	}

	/** The frame's point elements in z-order, positioned in thumbnail units. */
	marks(frame: Frame): ThumbnailMark[] {
		const fit = this.fit();
		return frame.elements.filter(FrameThumbnailGeometry.isPointElement).map((element) => {
			const at = this.viewport.sceneToStage(element, fit);
			return {
				id: element.id,
				type: element.type,
				color: element.color,
				x: at.x,
				y: at.y,
				radius: visualRadius(element.type) * FrameThumbnailGeometry.ELEMENT_ENLARGEMENT,
			};
		});
	}

	private fit() {
		return this.viewport.fit(this.width, this.height);
	}

	private static isPointElement(element: BoardElement): element is PointElement {
		return element instanceof PointElement;
	}
}
