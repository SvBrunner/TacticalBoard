import { PointElement } from "$lib/model/elements/PointElement";
import type { PointElementType } from "$lib/model/elements/ElementType";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/** Changes the type of a point element (e.g. Player → Circle), keeping its id, position, and color. */
export class ChangeElementTypeCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly elementId: string,
		readonly from: PointElementType,
		readonly to: PointElementType,
	) {
		this.label = `Change ${from} to ${to}`;
	}

	static of(element: PointElement, type: PointElementType): ChangeElementTypeCommand {
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
		return !(element instanceof PointElement) || element.type === this.to;
	}

	private retype(frame: Frame, type: PointElementType): Frame {
		return frame.updateElement(this.elementId, (element) =>
			element instanceof PointElement ? element.withType(type) : element,
		);
	}
}
