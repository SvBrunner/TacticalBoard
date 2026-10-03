import Konva from "konva";

/** Pointer travel (CSS px) before a press becomes a drag; Konva's default of 3 lets finger jitter start drags. */
export const DRAG_DISTANCE_PX = 6;

/** The subset of the Konva global this setup changes. */
export interface KonvaGlobals {
	dragDistance: number;
}

/** Applies the app-wide Konva settings. Idempotent; call once on mount. */
export function configureKonva(konva: KonvaGlobals = Konva): void {
	konva.dragDistance = DRAG_DISTANCE_PX;
}
