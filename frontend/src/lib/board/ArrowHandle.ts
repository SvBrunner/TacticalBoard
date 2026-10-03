import type { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import type { Point } from "$lib/model/Point";

export type ArrowHandleKind = "start" | "end" | "bend" | "insert";

/**
 * One handle of the selected arrow: its start, its end, one of its bends
 * (`index` = bend index), or an "add bend" handle in the middle of a
 * segment (`index` = segment index). Dragging a handle reshapes the arrow
 * (`apply`); dragging an "add bend" handle inserts a new bend there.
 */
export class ArrowHandle {
	private constructor(
		readonly kind: ArrowHandleKind,
		readonly index: number,
	) {}

	static start(): ArrowHandle {
		return new ArrowHandle("start", 0);
	}

	static end(): ArrowHandle {
		return new ArrowHandle("end", 0);
	}

	static bend(index: number): ArrowHandle {
		return new ArrowHandle("bend", index);
	}

	static insert(segmentIndex: number): ArrowHandle {
		return new ArrowHandle("insert", segmentIndex);
	}

	/**
	 * Every handle of an arrow, bottom to top: the "add bend" handles first,
	 * so where handles overlap (a short segment) the start, end and bend
	 * handles win.
	 */
	static allOf(geometry: ArrowGeometry): ArrowHandle[] {
		return [
			...Array.from({ length: geometry.segmentCount }, (_, segment) => ArrowHandle.insert(segment)),
			ArrowHandle.start(),
			...geometry.bends.map((_, index) => ArrowHandle.bend(index)),
			ArrowHandle.end(),
		];
	}

	/** Unique among the handles of one arrow. */
	get key(): string {
		return `${this.kind}-${this.index}`;
	}

	/** Whether this is the handle of an existing point the arrow passes through (not an "add bend" handle). */
	get isPoint(): boolean {
		return this.kind !== "insert";
	}

	/**
	 * The handle of the point this handle moves once applied: itself, except
	 * an "add bend" handle, whose new bend gets the bend index of its segment.
	 */
	afterDrag(): ArrowHandle {
		return this.kind === "insert" ? ArrowHandle.bend(this.index) : this;
	}

	/** Finds a handle of `geometry` by its key (e.g. from a Konva node's attributes). */
	static find(geometry: ArrowGeometry, key: string): ArrowHandle | undefined {
		return ArrowHandle.allOf(geometry).find((handle) => handle.key === key);
	}

	/** Where the handle sits on the arrow. */
	positionOn(geometry: ArrowGeometry): Point {
		switch (this.kind) {
			case "start":
				return geometry.start;
			case "end":
				return geometry.end;
			case "bend":
				return geometry.bends[this.index];
			case "insert":
				return geometry.segmentMidpoint(this.index);
		}
	}

	/** The arrow's shape with this handle dragged to `point`. */
	apply(geometry: ArrowGeometry, point: Point): ArrowGeometry {
		switch (this.kind) {
			case "start":
				return geometry.withStart(point);
			case "end":
				return geometry.withEnd(point);
			case "bend":
				return geometry.withBendMoved(this.index, point);
			case "insert":
				return geometry.withBendInserted(this.index, point);
		}
	}
}
