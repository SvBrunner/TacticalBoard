import type { Readable } from "svelte/store";
import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { isArrowElementType, type ArrowElementType, type PointElementType } from "$lib/model/elements/ElementType";
import type { SceneRect } from "$lib/model/FieldDimensions";
import type { Point } from "$lib/model/Point";
import type { ArrowHandle } from "./ArrowHandle";
import { ArrowGestures, type ArrowDraft, type GesturePoint } from "./ArrowGestures";
import type { ScreenRect } from "./BoardViewport";
import type { Tool } from "./ToolState";

/** The editing operations the board needs; implemented by `SituationEditor`. */
export interface BoardEditing {
	addElement(x: number, y: number, color: string, type: PointElementType): string;
	addArrow(start: Point, end: Point, color: string, type: ArrowElementType): string;
	removeElement(id: string): void;
	moveElement(id: string, x: number, y: number): void;
	reshapeArrow(id: string, geometry: ArrowGeometry): void;
	moveArrow(id: string, dx: number, dy: number): void;
	addBend(id: string, segmentIndex: number, point: Point): void;
	removeBend(id: string, bendIndex: number): void;
	endGesture(): void;
}

export interface ElementSelection {
	current(): string | null;
	select(id: string): void;
	selectBend(id: string, bendIndex: number): void;
	clearBend(): void;
	clear(): void;
}

export interface ToolSource {
	currentTool(): Tool;
	currentPlayerColor(): string;
}

export interface PopoverControl {
	isOpen(): boolean;
	open(anchor: ScreenRect): void;
	close(): void;
}

export interface SceneBounds {
	/** The visible area; elements are kept inside it. */
	readonly visibleRect: SceneRect;
	clamp(point: Point): Point;
}

export interface InteractionLog {
	notify(message: string): void;
}

export interface BoardInteractionDependencies {
	readonly editor: BoardEditing;
	readonly selection: ElementSelection;
	readonly tools: ToolSource;
	readonly popover: PopoverControl;
	readonly bounds: SceneBounds;
	/** Color for every placed point element that isn't a Player. */
	readonly neutralColor: string;
	/** Color of every newly drawn arrow. */
	readonly arrowColor: string;
	readonly log?: InteractionLog;
}

export interface TapModifiers {
	readonly shiftKey: boolean;
}

/** The parts of a keyboard event the controller looks at. */
export interface KeyInput {
	readonly key: string;
	readonly target: EventTarget | null;
	readonly isComposing?: boolean;
	preventDefault(): void;
}

const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Translates board gestures (already decoded from Konva events: tap on an
 * element, tap on the empty field, drag, keys) into editor calls and
 * selection/popover changes. Input-device agnostic: a mouse click and a
 * finger tap are the same "tap".
 *
 * While an arrow tool (Pass, Run, Shot) is active, taps and presses on the
 * board go through `ArrowGestures` instead (`pointerDown`/`pointerMove`/
 * `pointerUp`): press-and-drag or tap-tap draws an arrow; a tap on an
 * element with no start point pending still selects it. Elements can't be
 * dragged then (the canvas makes them non-draggable).
 */
export class BoardInteractionController {
	private readonly gestures: ArrowGestures;

	/** The arrow being drawn (rubber-band preview), `null` while none is. */
	readonly arrowDraft: Readable<ArrowDraft | null>;

	constructor(private readonly deps: BoardInteractionDependencies) {
		this.gestures = new ArrowGestures({ clamp: (point) => deps.bounds.clamp(point) });
		this.arrowDraft = this.gestures.draft;
	}

	/** Whether an arrow tool is active (taps and presses then draw arrows). */
	isDrawingArrows(): boolean {
		return isArrowElementType(this.deps.tools.currentTool());
	}

	/**
	 * Tap/click on an element: selects it and opens the edit popover,
	 * whatever tool is active. With Shift held (desktop) it deletes instead.
	 * Ignored while an arrow tool is active: the arrow gestures handle taps
	 * then (see `pointerUp`).
	 */
	tapElement(id: string, anchor: ScreenRect, modifiers: TapModifiers = { shiftKey: false }): void {
		if (this.isDrawingArrows()) {
			return;
		}
		this.activateElement(id, anchor, modifiers);
	}

	/** Right-click / long-press on an element: same as a tap (with any tool). */
	contextMenu(id: string, anchor: ScreenRect): void {
		this.activateElement(id, anchor, { shiftKey: false });
	}

	/**
	 * Tap/click on the empty field: places an element with a point
	 * placement tool (the tool stays active, the new element is not
	 * selected); with Move it only dismisses. Either way the selection and
	 * popover are cleared. Ignored while an arrow tool is active (see
	 * `pointerUp`).
	 */
	tapField(point: Point): void {
		const tool = this.deps.tools.currentTool();
		if (isArrowElementType(tool)) {
			return;
		}
		this.deps.selection.clear();
		this.deps.popover.close();

		if (tool === "Move") {
			this.log(`Tap ignored (tool is Move) at (${Math.round(point.x)}, ${Math.round(point.y)})`);
			return;
		}
		const position = this.deps.bounds.clamp(point);
		const color = tool === "Player" ? this.deps.tools.currentPlayerColor() : this.deps.neutralColor;
		this.deps.editor.addElement(position.x, position.y, color, tool);
		this.log(`Added ${tool} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
	}

	/**
	 * A pointer went down on the board, on the element `elementId` (point
	 * element or arrow) or on the empty field. Only used while an arrow tool
	 * is active; not for the handles of the selected arrow.
	 */
	pointerDown(point: GesturePoint, elementId: string | null): void {
		if (this.isDrawingArrows()) {
			this.gestures.down(point, elementId);
		}
	}

	pointerMove(point: GesturePoint): void {
		if (this.isDrawingArrows()) {
			this.gestures.move(point);
		}
	}

	/**
	 * A pointer was released: finishes a drawing gesture. A new arrow gets
	 * the arrow color and the active arrow type; the tool stays active and
	 * the new arrow is not selected. A tap on an element (no start pending)
	 * selects it like `tapElement`; `anchorOf` locates it on screen.
	 */
	pointerUp(point: GesturePoint, modifiers: TapModifiers, anchorOf: (id: string) => ScreenRect | null): void {
		const tool = this.deps.tools.currentTool();
		if (!isArrowElementType(tool)) {
			return;
		}
		const outcome = this.gestures.up(point);
		switch (outcome.kind) {
			case "startPlaced":
				this.deps.selection.clear();
				this.deps.popover.close();
				this.log(`${tool} start at (${Math.round(outcome.start.x)}, ${Math.round(outcome.start.y)})`);
				return;
			case "created":
				this.deps.selection.clear();
				this.deps.popover.close();
				this.deps.editor.addArrow(outcome.start, outcome.end, this.deps.arrowColor, tool);
				this.log(`Added ${tool}`);
				return;
			case "discarded":
				this.log(`${tool} too short, discarded`);
				return;
			case "tapElement": {
				const anchor = anchorOf(outcome.elementId);
				if (anchor) {
					this.activateElement(outcome.elementId, anchor, modifiers);
				}
				return;
			}
			case "none":
				return;
		}
	}

	/** The browser cancelled the pointer (e.g. a system gesture): drops the arrow being drawn. */
	pointerCancel(): void {
		this.gestures.cancel();
	}

	/** The tool changed: an arrow being drawn (or a pending start point) is dropped. */
	toolChanged(): void {
		this.gestures.cancel();
	}

	/** Dragging a whole arrow started: the popover gets out of the way, the selection stays. */
	arrowDragStart(_id: string): void {
		this.deps.popover.close();
	}

	/** Returns how far the arrow may be moved by `delta` so it stays in the visible area, keeping its shape. */
	arrowDragMove(geometry: ArrowGeometry, delta: Point): Point {
		return geometry.constrainTranslation(delta.x, delta.y, this.deps.bounds.visibleRect);
	}

	/** Dragging a whole arrow ended: the move is one undo step. */
	arrowDragEnd(id: string, geometry: ArrowGeometry, delta: Point): void {
		const allowed = this.arrowDragMove(geometry, delta);
		this.deps.editor.moveArrow(id, allowed.x, allowed.y);
		this.deps.editor.endGesture();
		this.log(`Moved ${id} by (${Math.round(allowed.x)}, ${Math.round(allowed.y)})`);
	}

	/** Dragging a handle of the selected arrow started: the popover gets out of the way. */
	handleDragStart(_id: string): void {
		this.deps.popover.close();
	}

	/** The arrow's shape while one of its handles is dragged to `point` (clamped), for the live preview. */
	handleDragMove(geometry: ArrowGeometry, handle: ArrowHandle, point: Point): ArrowGeometry {
		return handle.apply(geometry, this.deps.bounds.clamp(point));
	}

	/**
	 * A handle drag ended: one undo step. Dropping an "add bend" handle adds
	 * a bend there; any other handle reshapes the arrow.
	 */
	handleDragEnd(id: string, geometry: ArrowGeometry, handle: ArrowHandle, point: Point): void {
		const position = this.deps.bounds.clamp(point);
		if (handle.kind === "insert") {
			this.deps.editor.addBend(id, handle.index, position);
			this.log(`Added a bend to ${id}`);
		} else {
			this.deps.editor.reshapeArrow(id, handle.apply(geometry, position));
			this.log(`Reshaped ${id}`);
		}
		this.deps.editor.endGesture();
	}

	/**
	 * Tap on a handle of the selected arrow (any tool); the arrow stays
	 * selected. A bend handle becomes the active bend and the popover opens
	 * (it offers "Remove bend"); an "add bend" handle adds a bend at its
	 * position; the start and end handles only clear the active bend.
	 */
	tapHandle(id: string, geometry: ArrowGeometry, handle: ArrowHandle, anchor: ScreenRect): void {
		if (handle.kind === "bend") {
			this.deps.selection.selectBend(id, handle.index);
			this.deps.popover.open(anchor);
			return;
		}
		this.deps.selection.select(id);
		if (handle.kind === "insert") {
			this.deps.editor.addBend(id, handle.index, handle.positionOn(geometry));
			this.log(`Added a bend to ${id}`);
		}
	}

	/**
	 * "Edit shape" in the popover: the popover gets out of the way (on
	 * phones it can cover the whole board) but the arrow stays selected, so
	 * its handles can be dragged. Unlike Close, which clears the selection.
	 */
	editShape(): void {
		this.deps.popover.close();
	}

	/** Double-tap/double-click on a bend handle removes that bend; other handles ignore it. */
	doubleTapHandle(id: string, handle: ArrowHandle): void {
		if (handle.kind !== "bend") {
			return;
		}
		this.deps.editor.removeBend(id, handle.index);
		this.deps.selection.clearBend();
		this.log(`Removed bend ${handle.index + 1} of ${id}`);
	}

	/** A drag started: the popover gets out of the way, the selection stays. */
	dragStart(_id: string): void {
		this.deps.popover.close();
	}

	/** Returns where the dragged element may be, keeping it on the field. */
	dragMove(point: Point): Point {
		return this.deps.bounds.clamp(point);
	}

	/** A drag ended: the move becomes exactly one undo step. */
	dragEnd(id: string, point: Point): void {
		const position = this.deps.bounds.clamp(point);
		this.deps.editor.moveElement(id, position.x, position.y);
		this.deps.editor.endGesture();
		this.log(`Moved ${id} to (${Math.round(position.x)}, ${Math.round(position.y)})`);
	}

	/**
	 * The popover was closed by the user (its Close button or Escape): the
	 * selection is cleared as well, like Escape on the board.
	 */
	dismissPopover(): void {
		this.deps.selection.clear();
		this.deps.popover.close();
	}

	/**
	 * The stage geometry changed (resize, device rotation, another viewport):
	 * an open popover stays open and moves to the selected element's new
	 * on-screen bounds, as computed by `anchorOf`. Nothing happens while the
	 * popover is closed or when the element can't be located.
	 */
	relocatePopover(anchorOf: (id: string) => ScreenRect | null): void {
		if (!this.deps.popover.isOpen()) {
			return;
		}
		const id = this.deps.selection.current();
		const anchor = id === null ? null : anchorOf(id);
		if (anchor) {
			this.deps.popover.open(anchor);
		}
	}

	/**
	 * Escape drops an arrow being drawn, clears the selection and closes the
	 * popover; Delete/Backspace deletes the selected element. Ignored while typing in a text field.
	 * Returns true when the key was handled.
	 */
	keyDown(event: KeyInput): boolean {
		if (event.isComposing || BoardInteractionController.isTextEntry(event.target)) {
			return false;
		}
		if (event.key === "Escape") {
			this.gestures.cancel();
			this.deps.selection.clear();
			this.deps.popover.close();
			return true;
		}
		if (event.key === "Delete" || event.key === "Backspace") {
			const id = this.deps.selection.current();
			if (id === null) {
				return false;
			}
			event.preventDefault();
			this.remove(id);
			return true;
		}
		return false;
	}

	private activateElement(id: string, anchor: ScreenRect, modifiers: TapModifiers): void {
		if (modifiers.shiftKey) {
			this.remove(id);
			return;
		}
		this.deps.selection.select(id);
		this.deps.popover.open(anchor);
		this.log(`Selected ${id}`);
	}

	private remove(id: string): void {
		this.deps.editor.removeElement(id);
		if (this.deps.selection.current() === id) {
			this.deps.selection.clear();
		}
		this.deps.popover.close();
		this.log(`Deleted ${id}`);
	}

	private log(message: string): void {
		this.deps.log?.notify(message);
	}

	private static isTextEntry(target: EventTarget | null): boolean {
		return typeof Element !== "undefined" && target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null;
	}
}
