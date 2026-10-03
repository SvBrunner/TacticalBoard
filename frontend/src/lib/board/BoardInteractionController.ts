import type { Point } from "$lib/commands/Point";
import type { ElementType } from "$lib/model/elements/ElementType";
import type { ScreenRect } from "./BoardViewport";
import type { Tool } from "./ToolState";

/** The editing operations the board needs; implemented by `SituationEditor`. */
export interface BoardEditing {
	addElement(x: number, y: number, color: string, type: ElementType): string;
	removeElement(id: string): void;
	moveElement(id: string, x: number, y: number): void;
	endGesture(): void;
}

export interface ElementSelection {
	current(): string | null;
	select(id: string): void;
	clear(): void;
}

export interface ToolSource {
	currentTool(): Tool;
	currentPlayerColor(): string;
}

export interface PopoverControl {
	open(anchor: ScreenRect): void;
	close(): void;
}

export interface SceneBounds {
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
	/** Color for every placed element that isn't a Player. */
	readonly neutralColor: string;
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
 */
export class BoardInteractionController {
	constructor(private readonly deps: BoardInteractionDependencies) {}

	/**
	 * Tap/click on an element: selects it and opens the edit popover,
	 * whatever tool is active. With Shift held (desktop) it deletes instead.
	 */
	tapElement(id: string, anchor: ScreenRect, modifiers: TapModifiers = { shiftKey: false }): void {
		if (modifiers.shiftKey) {
			this.remove(id);
			return;
		}
		this.deps.selection.select(id);
		this.deps.popover.open(anchor);
		this.log(`Selected ${id}`);
	}

	/** Right-click / long-press on an element: same as a tap. */
	contextMenu(id: string, anchor: ScreenRect): void {
		this.tapElement(id, anchor);
	}

	/**
	 * Tap/click on the empty field: places an element with a placement tool
	 * (the tool stays active, the new element is not selected); with Move it
	 * only dismisses. Either way the selection and popover are cleared.
	 */
	tapField(point: Point): void {
		this.deps.selection.clear();
		this.deps.popover.close();

		const tool = this.deps.tools.currentTool();
		if (tool === "Move") {
			this.log(`Tap ignored (tool is Move) at (${Math.round(point.x)}, ${Math.round(point.y)})`);
			return;
		}
		const position = this.deps.bounds.clamp(point);
		const color = tool === "Player" ? this.deps.tools.currentPlayerColor() : this.deps.neutralColor;
		this.deps.editor.addElement(position.x, position.y, color, tool);
		this.log(`Added ${tool} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
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
	 * Escape clears the selection and closes the popover; Delete/Backspace
	 * deletes the selected element. Ignored while typing in a text field.
	 * Returns true when the key was handled.
	 */
	keyDown(event: KeyInput): boolean {
		if (event.isComposing || BoardInteractionController.isTextEntry(event.target)) {
			return false;
		}
		if (event.key === "Escape") {
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
