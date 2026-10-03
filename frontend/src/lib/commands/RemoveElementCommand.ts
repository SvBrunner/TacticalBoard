import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/** Removes an element; undo restores it at its original z-order position. */
export class RemoveElementCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly element: BoardElement,
		/** The element's z-order position before removal. */
		readonly index: number,
	) {
		this.label = `Delete ${element.type}`;
	}

	/** Captures the element and its position from `frame`, or `undefined` if the frame doesn't contain it. */
	static of(frame: Frame, elementId: string): RemoveElementCommand | undefined {
		const index = frame.indexOfElement(elementId);
		return index < 0 ? undefined : new RemoveElementCommand(frame.elements[index], index);
	}

	execute(frame: Frame): Frame {
		return frame.removeElement(this.element.id);
	}

	undo(frame: Frame): Frame {
		return frame.insertElement(this.element, this.index);
	}

	isNoOp(frame: Frame): boolean {
		return !frame.findElement(this.element.id);
	}
}
