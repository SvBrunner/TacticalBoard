import type { IdGenerator } from "../ids/IdGenerator";
import type { Point } from "../Point";
import { ArrowGeometry } from "./ArrowGeometry";
import { BoardElement } from "./BoardElement";
import type { ArrowElementType } from "./ElementType";

/**
 * A pass, run or shot: a curve from `start` through its bend points to
 * `end`, in full-field scene units, with an arrowhead at the end (see
 * `ArrowGeometry`). Arrows are free: they are not attached to players and
 * have no label.
 */
export class ArrowElement extends BoardElement {
	readonly start: Point;
	readonly end: Point;
	readonly bends: readonly Point[];

	constructor(
		id: string,
		readonly type: ArrowElementType,
		color: string,
		geometry: ArrowGeometry,
	) {
		super(id, color);
		this.start = geometry.start;
		this.end = geometry.end;
		this.bends = geometry.bends;
	}

	/** A new arrow with a fresh id. */
	static create(ids: IdGenerator, type: ArrowElementType, color: string, geometry: ArrowGeometry): ArrowElement {
		return new ArrowElement(ids.next(), type, color, geometry);
	}

	get geometry(): ArrowGeometry {
		return new ArrowGeometry(this.start, this.end, this.bends);
	}

	withGeometry(geometry: ArrowGeometry): ArrowElement {
		return new ArrowElement(this.id, this.type, this.color, geometry);
	}

	withColor(color: string): ArrowElement {
		return new ArrowElement(this.id, this.type, color, this.geometry);
	}

	withType(type: ArrowElementType): ArrowElement {
		return new ArrowElement(this.id, type, this.color, this.geometry);
	}
}
