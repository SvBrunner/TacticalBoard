import { writable, type Readable } from "svelte/store";
import type { Point } from "$lib/model/Point";

/** One pointer sample, already converted by the canvas. */
export interface GesturePoint {
	readonly pointerId: number;
	/** Position in full-field scene units (not clamped yet). */
	readonly scene: Point;
	/** Position on screen in CSS px (any fixed origin); used for the drag threshold. */
	readonly screen: Point;
	/** CSS px per scene unit right now; used for the minimum arrow length. */
	readonly scale: number;
}

/** The arrow being drawn, for the rubber-band preview: the start, and the end once there is one. */
export interface ArrowDraft {
	readonly start: Point;
	readonly end: Point | null;
}

/** What a released pointer amounts to. */
export type ArrowGestureOutcome =
	| { readonly kind: "none" }
	/** A tap on the empty field set the start point; the next release sets the end. */
	| { readonly kind: "startPlaced"; readonly start: Point }
	| { readonly kind: "created"; readonly start: Point; readonly end: Point }
	/** Start and end were too close together: no arrow. */
	| { readonly kind: "discarded" }
	/** A tap on an element while no start point was pending: the element is meant, not a new arrow. */
	| { readonly kind: "tapElement"; readonly elementId: string };

export interface ArrowGestureOptions {
	/** Keeps points inside the visible area. */
	readonly clamp: (point: Point) => Point;
	/** Pointer travel (CSS px) before a press becomes a drag. */
	readonly dragThresholdPx?: number;
	/** Arrows shorter than this on screen (CSS px) are discarded. */
	readonly minLengthPx?: number;
}

interface Press {
	readonly pointerId: number;
	readonly origin: Point;
	readonly start: Point;
	readonly elementId: string | null;
	dragging: boolean;
}

/**
 * Turns pointer input into arrows while an arrow tool is active. Pure
 * state machine (no Konva, no DOM): the canvas feeds it pointer samples,
 * the controller acts on the outcomes. Two ways to draw:
 *
 * - **Press and drag**: the press point is the start, the release point
 *   the end. A press only becomes a drag after the pointer moved
 *   `dragThresholdPx`; a press on an element starts an arrow there too.
 * - **Tap, tap**: a tap on the empty field sets a pending start point; the
 *   next release (a tap or the end of a drag, anywhere, also on an
 *   element) sets the end. While a start is pending, the preview follows
 *   the pointer (hover with a mouse, drag with a finger).
 *
 * A tap on an element with no start pending is reported as `tapElement`
 * (it selects the element, as with every other tool). Arrows shorter than
 * `minLengthPx` on screen are discarded. `cancel` (Escape, tool change,
 * pointercancel) and a second pointer going down drop everything. All
 * points are clamped to the visible area.
 */
export class ArrowGestures {
	static readonly DRAG_THRESHOLD_PX = 6;
	static readonly MIN_LENGTH_PX = 24;

	private readonly clamp: (point: Point) => Point;
	private readonly dragThresholdPx: number;
	private readonly minLengthPx: number;
	private readonly draftStore = writable<ArrowDraft | null>(null);

	private press: Press | null = null;
	private pendingStart: Point | null = null;

	/** The rubber-band preview; `null` while nothing is being drawn. */
	readonly draft: Readable<ArrowDraft | null> = { subscribe: this.draftStore.subscribe };

	constructor(options: ArrowGestureOptions) {
		this.clamp = options.clamp;
		this.dragThresholdPx = options.dragThresholdPx ?? ArrowGestures.DRAG_THRESHOLD_PX;
		this.minLengthPx = options.minLengthPx ?? ArrowGestures.MIN_LENGTH_PX;
	}

	/** Whether a pointer is down or a start point is pending. */
	get isActive(): boolean {
		return this.press !== null || this.pendingStart !== null;
	}

	/** A pointer went down, on the element `elementId` or on the empty field (`null`). */
	down(point: GesturePoint, elementId: string | null): void {
		if (this.press) {
			// A second finger (or button): not a drawing gesture.
			this.cancel();
			return;
		}
		this.press = {
			pointerId: point.pointerId,
			origin: point.screen,
			start: this.clamp(point.scene),
			elementId,
			dragging: false,
		};
	}

	move(point: GesturePoint): void {
		const press = this.press;
		if (!press) {
			if (this.pendingStart) {
				this.showDraft(this.pendingStart, this.clamp(point.scene));
			}
			return;
		}
		if (point.pointerId !== press.pointerId) {
			return;
		}
		if (!press.dragging && ArrowGestures.distance(press.origin, point.screen) >= this.dragThresholdPx) {
			press.dragging = true;
		}
		if (press.dragging || this.pendingStart) {
			this.showDraft(this.pendingStart ?? press.start, this.clamp(point.scene));
		}
	}

	up(point: GesturePoint): ArrowGestureOutcome {
		const press = this.press;
		if (!press || point.pointerId !== press.pointerId) {
			return { kind: "none" };
		}
		this.press = null;
		const end = this.clamp(point.scene);
		if (this.pendingStart) {
			return this.finish(this.pendingStart, end, point.scale);
		}
		if (press.dragging) {
			return this.finish(press.start, end, point.scale);
		}
		if (press.elementId !== null) {
			return { kind: "tapElement", elementId: press.elementId };
		}
		this.pendingStart = press.start;
		this.showDraft(press.start, null);
		return { kind: "startPlaced", start: press.start };
	}

	/** Drops the pressed pointer, the pending start and the preview. Returns whether there was anything to drop. */
	cancel(): boolean {
		const active = this.isActive;
		this.press = null;
		this.pendingStart = null;
		this.draftStore.set(null);
		return active;
	}

	private finish(start: Point, end: Point, scale: number): ArrowGestureOutcome {
		this.cancel();
		if (ArrowGestures.distance(start, end) * scale < this.minLengthPx) {
			return { kind: "discarded" };
		}
		return { kind: "created", start, end };
	}

	private showDraft(start: Point, end: Point | null): void {
		this.draftStore.set({ start, end });
	}

	private static distance(a: Point, b: Point): number {
		return Math.hypot(b.x - a.x, b.y - a.y);
	}
}
