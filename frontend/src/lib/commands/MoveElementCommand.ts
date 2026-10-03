import type { Command } from "$lib/history/Command";
import { PointElement } from "$lib/model/elements/PointElement";
import type { PointElementType } from "$lib/model/elements/ElementType";
import type { Frame } from "$lib/model/Frame";
import type { FrameCommand } from "./FrameCommand";
import { samePoint, type Point } from "$lib/model/Point";

/**
 * Moves a point element. A later move of the same element merges into this
 * one (keeping the original start position) until the history is sealed.
 */
export class MoveElementCommand implements FrameCommand {
	readonly label: string;

	constructor(
		readonly elementId: string,
		readonly elementType: PointElementType,
		readonly from: Point,
		readonly to: Point,
	) {
		this.label = `Move ${elementType}`;
	}

	static of(element: PointElement, x: number, y: number): MoveElementCommand {
		return new MoveElementCommand(element.id, element.type, { x: element.x, y: element.y }, { x, y });
	}

	execute(frame: Frame): Frame {
		return this.moveTo(frame, this.to);
	}

	undo(frame: Frame): Frame {
		return this.moveTo(frame, this.from);
	}

	isNoOp(frame: Frame): boolean {
		const element = frame.findElement(this.elementId);
		return !(element instanceof PointElement) || samePoint(element, this.to);
	}

	mergeWith(next: Command<Frame>): FrameCommand | undefined {
		if (!(next instanceof MoveElementCommand) || next.elementId !== this.elementId) {
			return undefined;
		}
		return new MoveElementCommand(this.elementId, this.elementType, this.from, next.to);
	}

	private moveTo(frame: Frame, point: Point): Frame {
		return frame.updateElement(this.elementId, (element) =>
			element instanceof PointElement ? element.withPosition(point.x, point.y) : element,
		);
	}
}
