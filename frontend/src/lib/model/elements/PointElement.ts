import type { IdGenerator } from "../ids/IdGenerator";
import { BoardElement } from "./BoardElement";
import type { PointElementType } from "./ElementType";

/**
 * An element placed at a single position, in full-field scene units.
 *
 * `label` is a short position label (e.g. "C"); empty means no label. Only
 * players show and edit it, but every point element keeps it, so changing a
 * player to another type and back does not lose the label.
 */
export class PointElement extends BoardElement {
	constructor(
		id: string,
		readonly x: number,
		readonly y: number,
		color: string,
		readonly type: PointElementType,
		readonly label: string = "",
	) {
		super(id, color);
	}

	/** A new element with a fresh id and no label. */
	static create(ids: IdGenerator, x: number, y: number, color: string, type: PointElementType): PointElement {
		return new PointElement(ids.next(), x, y, color, type);
	}

	withPosition(x: number, y: number): PointElement {
		return new PointElement(this.id, x, y, this.color, this.type, this.label);
	}

	withColor(color: string): PointElement {
		return new PointElement(this.id, this.x, this.y, color, this.type, this.label);
	}

	withType(type: PointElementType): PointElement {
		return new PointElement(this.id, this.x, this.y, this.color, type, this.label);
	}

	withLabel(label: string): PointElement {
		return new PointElement(this.id, this.x, this.y, this.color, this.type, label);
	}

	/** Whether the label is shown: only players show it, and only when it is set. */
	get showsLabel(): boolean {
		return this.type === "Player" && this.label !== "";
	}
}
