import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { ElementType } from "$lib/model/elements/ElementType";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/** Changes an element's color. */
export class ChangeElementColorCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly elementId: string,
		readonly elementType: ElementType,
		readonly from: string,
		readonly to: string,
	) {
		this.label = `Change ${elementType} color`;
	}

	static of(element: BoardElement, color: string): ChangeElementColorCommand {
		return new ChangeElementColorCommand(element.id, element.type, element.color, color);
	}

	execute(frame: Frame): Frame {
		return this.recolor(frame, this.to);
	}

	undo(frame: Frame): Frame {
		return this.recolor(frame, this.from);
	}

	isNoOp(frame: Frame): boolean {
		const element = frame.findElement(this.elementId);
		return !element || element.color === this.to;
	}

	private recolor(frame: Frame, color: string): Frame {
		return frame.updateElement(this.elementId, (element) => element.withColor(color));
	}
}
