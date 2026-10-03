import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/** Adds an element on top of the frame. Redo re-adds the very same element (same id). */
export class AddElementCommand implements FrameCommand {
	readonly label: string;

	constructor(readonly element: BoardElement) {
		this.label = `Add ${element.type}`;
	}

	execute(frame: Frame): Frame {
		return frame.addElement(this.element);
	}

	undo(frame: Frame): Frame {
		return frame.removeElement(this.element.id);
	}

	isNoOp(): boolean {
		return false;
	}
}
