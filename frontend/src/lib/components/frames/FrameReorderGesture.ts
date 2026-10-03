import type { Point } from "$lib/commands/Point";

/** Extent of one item along the strip's main axis (CSS px, in the list's scrollable content coordinates). */
export interface Slot {
	readonly start: number;
	readonly end: number;
}

/** The pointer types of Pointer Events. */
export type PointerKind = "mouse" | "pen" | "touch";

export type ReorderPhase = "pending" | "dragging" | "cancelled" | "finished";

/** A reorder the gesture asks for: move the item at `from` so that it ends up at index `to`. */
export interface Reorder {
	readonly from: number;
	readonly to: number;
}

/**
 * Pure state machine for reordering items of a horizontal strip by
 * dragging, shared by mouse, pen and touch (fed from Pointer Events, so it
 * works where HTML5 drag and drop doesn't, e.g. on touch screens).
 *
 * - Mouse/pen: the drag starts once the pointer moved more than
 *   `DRAG_THRESHOLD_PX` from where it was pressed; a smaller movement stays
 *   a tap (selection is left to the item's own click).
 * - Touch: the drag starts after the finger was held still for
 *   `LONG_PRESS_MS` (`holdElapsed()`); moving earlier is a scroll of the
 *   strip and cancels the gesture.
 * - `cancel()` (pointercancel, lost capture, Escape) ends it without a reorder.
 *
 * While dragging, the dragged item follows the pointer (`offset`), and its
 * target index is the number of other items whose center lies before the
 * dragged item's center. The other items make room (`shiftFor`).
 */
export class FrameReorderGesture {
	static readonly DRAG_THRESHOLD_PX = 8;
	static readonly LONG_PRESS_MS = 400;
	/** Distance from the strip's edge (CSS px) in which a drag scrolls the strip. */
	static readonly AUTO_SCROLL_ZONE_PX = 40;
	/** Fastest auto-scroll, in CSS px per animation frame. */
	static readonly AUTO_SCROLL_MAX_STEP_PX = 12;

	private currentPhase: ReorderPhase = "pending";
	private pointer: Point;
	private dragged = false;

	constructor(
		readonly fromIndex: number,
		private readonly slots: readonly Slot[],
		private readonly start: Point,
		readonly pointerKind: PointerKind,
	) {
		if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= slots.length) {
			throw new Error(`fromIndex ${fromIndex} is outside the ${slots.length} slots`);
		}
		this.pointer = start;
	}

	get phase(): ReorderPhase {
		return this.currentPhase;
	}

	get isDragging(): boolean {
		return this.currentPhase === "dragging";
	}

	/** Whether the gesture turned into a drag at some point (the click that follows it is not a tap). */
	get didDrag(): boolean {
		return this.dragged;
	}

	/** Whether the gesture still needs pointer events (it hasn't ended or been cancelled). */
	get isActive(): boolean {
		return this.currentPhase === "pending" || this.currentPhase === "dragging";
	}

	/** How far the dragged item is moved along the main axis; 0 unless dragging. */
	get offset(): number {
		return this.isDragging ? this.pointer.x - this.start.x : 0;
	}

	/** Where the dragged item would end up if released now; `fromIndex` unless dragging. */
	get targetIndex(): number {
		if (!this.isDragging) {
			return this.fromIndex;
		}
		const draggedCenter = FrameReorderGesture.center(this.slots[this.fromIndex]) + this.offset;
		return this.slots.filter(
			(slot, index) => index !== this.fromIndex && FrameReorderGesture.center(slot) < draggedCenter,
		).length;
	}

	/** The pointer moved (same coordinates as the slots). */
	move(point: Point): void {
		if (!this.isActive) {
			return;
		}
		this.pointer = point;
		if (this.currentPhase !== "pending" || !this.beyondThreshold(point)) {
			return;
		}
		if (this.pointerKind === "touch") {
			this.currentPhase = "cancelled"; // moved before the long press: the strip scrolls
		} else {
			this.startDragging();
		}
	}

	/** The long-press time elapsed without the pointer moving away: a touch drag starts. */
	holdElapsed(): void {
		if (this.currentPhase === "pending" && this.pointerKind === "touch") {
			this.startDragging();
		}
	}

	/** The pointer was released: returns the reorder to apply, or `null` when the order stays. */
	release(): Reorder | null {
		const wasDragging = this.isDragging;
		const to = this.targetIndex;
		if (this.isActive) {
			this.currentPhase = "finished";
		}
		return wasDragging && to !== this.fromIndex ? { from: this.fromIndex, to } : null;
	}

	/** Ends the gesture without reordering. */
	cancel(): void {
		if (this.isActive) {
			this.currentPhase = "cancelled";
		}
	}

	/** How far (CSS px) the item at `index` moves aside to make room for the dragged item. */
	shiftFor(index: number): number {
		if (!this.isDragging || index === this.fromIndex) {
			return 0;
		}
		const to = this.targetIndex;
		const step = this.step();
		if (this.fromIndex < to && index > this.fromIndex && index <= to) {
			return -step;
		}
		if (to < this.fromIndex && index >= to && index < this.fromIndex) {
			return step;
		}
		return 0;
	}

	/**
	 * Auto-scroll speed while dragging near an edge of the visible strip:
	 * negative near the start, positive near the end, 0 elsewhere. All
	 * values in CSS px along the main axis (e.g. client coordinates).
	 */
	static autoScrollStep(pointer: number, visibleStart: number, visibleEnd: number): number {
		const zone = Math.min(FrameReorderGesture.AUTO_SCROLL_ZONE_PX, (visibleEnd - visibleStart) / 4);
		if (!(zone > 0)) {
			return 0;
		}
		const max = FrameReorderGesture.AUTO_SCROLL_MAX_STEP_PX;
		if (pointer < visibleStart + zone) {
			return 0 - Math.round(max * Math.min(1, (visibleStart + zone - pointer) / zone));
		}
		if (pointer > visibleEnd - zone) {
			return Math.round(max * Math.min(1, (pointer - (visibleEnd - zone)) / zone));
		}
		return 0;
	}

	private startDragging(): void {
		this.currentPhase = "dragging";
		this.dragged = true;
	}

	private beyondThreshold(point: Point): boolean {
		return Math.hypot(point.x - this.start.x, point.y - this.start.y) > FrameReorderGesture.DRAG_THRESHOLD_PX;
	}

	/** The dragged item's width plus the gap to its neighbour. */
	private step(): number {
		const slot = this.slots[this.fromIndex];
		const width = slot.end - slot.start;
		const gap = this.slots.length > 1 ? Math.max(0, this.slots[1].start - this.slots[0].end) : 0;
		return width + gap;
	}

	private static center(slot: Slot): number {
		return (slot.start + slot.end) / 2;
	}
}
