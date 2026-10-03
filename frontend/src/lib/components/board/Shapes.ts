import type { PointElementType } from "$lib/model/elements/ElementType";

/** The field's surface color: always the light look, also in the dark theme and in exports. */
export const FIELD_SURFACE_COLOR = "white";

/** Konva node name identifying point elements (as opposed to the field) in hit tests. */
export const ELEMENT_NODE_NAME = "Component";

/** Konva node name identifying arrows in hit tests. */
export const ARROW_NODE_NAME = "Arrow";

/** Konva node name of the handles of the selected arrow (start, end, bends, "add bend"). */
export const ARROW_HANDLE_NODE_NAME = "ArrowHandle";

/** Konva node name of the preview of an arrow being drawn (its start marker and the arrow). */
export const ARROW_DRAFT_NODE_NAME = "ArrowDraftStart";

/** Konva node name of the label text drawn on an element. */
export const LABEL_NODE_NAME = "ElementLabel";

/**
 * Label text on a player (scene units): a box centered on the element, as
 * wide as the player circle, with a bold font sized so two characters fit.
 */
export const LABEL_STYLE = {
	box: 40,
	fontSize: 20,
	fontFamily: '"Space Grotesk", system-ui, -apple-system, sans-serif',
} as const;

/** Draws a shape centered on its origin (scene units). */
export type DrawFunction = (context: any, shape: any) => void;

export function drawPlayer(context: any, shape: any) {
	context.beginPath();
	context.arc(0, 0, 20, 0, 2 * Math.PI);
	context.closePath();
	context.fillStrokeShape(shape);
}

export function drawBall(context: any, shape: any) {
	context.beginPath();
	context.arc(0, 0, 12, 0, 2 * Math.PI);
	context.closePath();
	context.fillStrokeShape(shape);

	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.arc(0, 0, 6, 0, 2 * Math.PI);
	context.fill();
	context.restore();
}

export function drawCircle(context: any, shape: any) {
	context.beginPath();
	context.arc(0, 0, 20, 0, 2 * Math.PI); // outer circle
	context.closePath();
	context.fillStrokeShape(shape); // Konva specific method
	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.arc(0, 0, 10, 0, 2 * Math.PI);
	context.fill();
	context.restore();
}

export function drawRectangle(context: any, shape: any) {
	context.beginPath();
	context.rect(-20, -20, 40, 40);
	context.closePath();
	context.fillStrokeShape(shape);

	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.rect(-10, -10, 20, 20);
	context.fill();
	context.restore();
}

export function drawTriangle(context: any, shape: any) {
	context.beginPath();
	context.moveTo(0, -20);
	context.lineTo(18, 15);
	context.lineTo(-18, 15);
	context.closePath();
	context.fillStrokeShape(shape);

	context.save();
	context.globalCompositeOperation = "destination-out";
	context.beginPath();
	context.moveTo(0, -10);
	context.lineTo(9, 7);
	context.lineTo(-9, 7);
	context.closePath();
	context.fill();
	context.restore();
}

const DRAW_FUNCTIONS: Record<PointElementType, DrawFunction> = {
	Player: drawPlayer,
	Ball: drawBall,
	Rectangle: drawRectangle,
	Triangle: drawTriangle,
	Circle: drawCircle,
};

export function drawFunctionFor(type: PointElementType): DrawFunction {
	return DRAW_FUNCTIONS[type] ?? drawPlayer;
}

/**
 * Radius (scene units) of the smallest circle around the origin that
 * contains the element's drawing, i.e. its visible extent.
 */
export function visualRadius(type: PointElementType): number {
	switch (type) {
		case "Ball":
			return 12;
		case "Rectangle":
			return Math.hypot(20, 20);
		case "Triangle":
			return Math.hypot(18, 15);
		case "Player":
		case "Circle":
		default:
			return 20;
	}
}

/**
 * Hit-region function: a solid circle of the given radius. Used as Konva
 * `hitFunc`, so the hit area has no cut-out holes and can be larger than the
 * drawing (touch targets).
 */
export function drawHitCircle(radius: number): DrawFunction {
	return (context, shape) => {
		context.beginPath();
		context.arc(0, 0, radius, 0, 2 * Math.PI);
		context.closePath();
		context.fillStrokeShape(shape);
	};
}
