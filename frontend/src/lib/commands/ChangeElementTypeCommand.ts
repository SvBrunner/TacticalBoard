import { ArrowElement } from "$lib/model/elements/ArrowElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import {
	isArrowElementType,
	isPointElementType,
	sameFamily,
	type ElementType,
} from "$lib/model/elements/ElementType";
import { PointElement } from "$lib/model/elements/PointElement";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/**
 * Changes an element's type within its family, keeping everything else:
 * a point element to another point type (e.g. Player → Circle; position
 * and label are kept) or an arrow to another arrow type (e.g. Pass → Shot;
 * its shape is kept). Changing between the families is not possible.
 */
export class ChangeElementTypeCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly elementId: string,
		readonly from: ElementType,
		readonly to: ElementType,
	) {
		if (!sameFamily(from, to)) {
			throw new Error(`Cannot change ${from} to ${to}: types can only change within their family`);
		}
		this.label = `Change ${from} to ${to}`;
	}

	static of(element: BoardElement, type: ElementType): ChangeElementTypeCommand {
		return new ChangeElementTypeCommand(element.id, element.type, type);
	}

	execute(frame: Frame): Frame {
		return this.retype(frame, this.to);
	}

	undo(frame: Frame): Frame {
		return this.retype(frame, this.from);
	}

	isNoOp(frame: Frame): boolean {
		const element = frame.findElement(this.elementId);
		return !element || !sameFamily(element.type, this.to) || element.type === this.to;
	}

	private retype(frame: Frame, type: ElementType): Frame {
		return frame.updateElement(this.elementId, (element) => ChangeElementTypeCommand.withType(element, type));
	}

	private static withType(element: BoardElement, type: ElementType): BoardElement {
		if (element instanceof PointElement && isPointElementType(type)) {
			return element.withType(type);
		}
		if (element instanceof ArrowElement && isArrowElementType(type)) {
			return element.withType(type);
		}
		return element;
	}
}
