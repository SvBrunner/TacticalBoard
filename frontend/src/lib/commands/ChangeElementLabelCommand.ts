import type { Command } from "$lib/history/Command";
import { PointElement } from "$lib/model/elements/PointElement";
import type { PointElementType } from "$lib/model/elements/ElementType";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";

/**
 * Changes a point element's position label. A later label change of the same
 * element merges into this one (keeping the original label) until the
 * history is sealed, so one text-field edit session is one undo step.
 */
export class ChangeElementLabelCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly elementId: string,
		readonly elementType: PointElementType,
		readonly from: string,
		readonly to: string,
	) {
		this.label = `Change ${elementType} label`;
	}

	static of(element: PointElement, label: string): ChangeElementLabelCommand {
		return new ChangeElementLabelCommand(element.id, element.type, element.label, label);
	}

	execute(frame: Frame): Frame {
		return this.relabel(frame, this.to);
	}

	undo(frame: Frame): Frame {
		return this.relabel(frame, this.from);
	}

	isNoOp(frame: Frame): boolean {
		const element = frame.findElement(this.elementId);
		return !(element instanceof PointElement) || element.label === this.to;
	}

	mergeWith(next: Command<Frame>): FrameCommand | undefined {
		if (!(next instanceof ChangeElementLabelCommand) || next.elementId !== this.elementId) {
			return undefined;
		}
		return new ChangeElementLabelCommand(this.elementId, this.elementType, this.from, next.to);
	}

	private relabel(frame: Frame, label: string): Frame {
		return frame.updateElement(this.elementId, (element) =>
			element instanceof PointElement ? element.withLabel(label) : element,
		);
	}
}
