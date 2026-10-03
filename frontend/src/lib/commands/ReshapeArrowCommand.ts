import type { Command } from "$lib/history/Command";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import type { ArrowElementType } from "$lib/model/elements/ElementType";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/**
 * Changes an arrow's shape: dragging its start, end or a bend, adding or
 * removing a bend, straightening it, or moving the whole arrow. A later
 * reshape of the same arrow merges into this one (keeping the original
 * shape and this command's label) until the history is sealed, so one drag
 * gesture is one undo step.
 */
export class ReshapeArrowCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly elementId: string,
		readonly elementType: ArrowElementType,
		readonly from: ArrowGeometry,
		readonly to: ArrowGeometry,
		/** What the reshape does, e.g. "Move" or "Straighten"; the label becomes "<action> <type>". */
		readonly action = "Reshape",
	) {
		this.label = `${action} ${elementType}`;
	}

	static of(element: ArrowElement, geometry: ArrowGeometry, action?: string): ReshapeArrowCommand {
		return new ReshapeArrowCommand(element.id, element.type, element.geometry, geometry, action);
	}

	execute(frame: Frame): Frame {
		return this.reshape(frame, this.to);
	}

	undo(frame: Frame): Frame {
		return this.reshape(frame, this.from);
	}

	isNoOp(frame: Frame): boolean {
		const element = frame.findElement(this.elementId);
		return !(element instanceof ArrowElement) || element.geometry.equals(this.to);
	}

	mergeWith(next: Command<Frame>): FrameCommand | undefined {
		if (!(next instanceof ReshapeArrowCommand) || next.elementId !== this.elementId) {
			return undefined;
		}
		return new ReshapeArrowCommand(this.elementId, this.elementType, this.from, next.to, this.action);
	}

	private reshape(frame: Frame, geometry: ArrowGeometry): Frame {
		return frame.updateElement(this.elementId, (element) =>
			element instanceof ArrowElement ? element.withGeometry(geometry) : element,
		);
	}
}
