import type { KonvaEventObject } from "konva/lib/Node";
import type { ArrowElement } from "$lib/model/elements/ArrowElement";
import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import type { PointElementType } from "$lib/model/elements/ElementType";
import type { Point } from "$lib/model/Point";

/**
 * How the elements of a `BoardScene` react to the user. Without it the
 * scene is a picture only (e.g. for the GIF export): nothing listens,
 * nothing is draggable or selected. Implemented by `BoardCanvas`.
 */
export interface SceneInteraction {
	/** Whether the elements receive pointer events at all. */
	readonly listening: boolean;
	readonly draggable: boolean;
	/** The element drawn with the selection highlight. */
	readonly selectedId: string | null;
	/** Width of an arrow's hit region along the curve, in scene units. */
	readonly arrowHitWidth: number;
	/** Hit radius of a point element (scene units). */
	hitRadius(type: PointElementType): number;
	/** The shape an arrow is drawn with (e.g. a preview while one of its handles is dragged). */
	arrowGeometry(arrow: ArrowElement): ArrowGeometry;
	pointDragStart(id: string): void;
	/** Returns the position the element may move to. */
	pointDragMove(position: Point): Point;
	pointDragEnd(id: string, position: Point): void;
	arrowDragStart(arrow: ArrowElement): void;
	/** Returns how far the arrow may be moved. */
	arrowDragMove(arrow: ArrowElement, delta: Point): Point;
	arrowDragEnd(arrow: ArrowElement, delta: Point): void;
}

/** The stage-level pointer events a `BoardScene` forwards to its owner. */
export interface SceneStageEvents {
	onpointerclick?: (event: KonvaEventObject<PointerEvent>) => void;
	onpointerdblclick?: (event: KonvaEventObject<PointerEvent>) => void;
	onpointerdown?: (event: KonvaEventObject<PointerEvent>) => void;
	oncontextmenu?: (event: KonvaEventObject<MouseEvent>) => void;
}

