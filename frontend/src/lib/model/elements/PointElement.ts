import type { IdGenerator } from "../ids/IdGenerator";
import { BoardElement } from "./BoardElement";
import type { PointElementType } from "./ElementType";

/** An element placed at a single position, in full-field scene units. */
export class PointElement extends BoardElement {
	constructor(
		id: string,
		readonly x: number,
		readonly y: number,
		color: string,
		readonly type: PointElementType,
	) {
		super(id, color);
	}

	static create(ids: IdGenerator, x: number, y: number, color: string, type: PointElementType): PointElement {
		return new PointElement(ids.next(), x, y, color, type);
	}

	withPosition(x: number, y: number): PointElement {
		return new PointElement(this.id, x, y, this.color, this.type);
	}

	withColor(color: string): PointElement {
		return new PointElement(this.id, this.x, this.y, color, this.type);
	}

	withType(type: PointElementType): PointElement {
		return new PointElement(this.id, this.x, this.y, this.color, type);
	}
}
