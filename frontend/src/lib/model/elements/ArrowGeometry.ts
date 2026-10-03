import type { SceneRect } from "../FieldDimensions";
import { samePoint, type Point } from "../Point";

/** One cubic Bézier piece of an arrow's curve, from `p0` to `p1` with control points `c1`, `c2`. */
export interface CubicSegment {
	readonly p0: Point;
	readonly c1: Point;
	readonly c2: Point;
	readonly p1: Point;
}

/**
 * The shape of an arrow, in full-field scene units: a smooth curve from
 * `start` through every bend point (in order) to `end`. Without bends the
 * arrow is a straight line. Immutable: change methods return a new instance.
 *
 * **Curve:** a uniform Catmull-Rom spline through start → bends → end,
 * converted to one cubic Bézier per segment (segment `i` runs from
 * `points[i]` to `points[i + 1]`). The end points are duplicated as phantom
 * neighbours, so the curve starts and ends heading towards its neighbouring
 * point. The curve passes exactly through every point, so a dragged bend
 * stays under the finger; with no bends all control points lie on the line
 * and the arrow is straight. Cubic Béziers draw natively on a canvas
 * (`bezierCurveTo`) and in SVG (`C`).
 */
export class ArrowGeometry {
	/** Samples per segment used for `bounds` (fine enough for an anchor rect). */
	private static readonly BOUNDS_SAMPLES = 24;

	readonly start: Point;
	readonly end: Point;
	/** The points the curve passes through between start and end, in order. */
	readonly bends: readonly Point[];

	constructor(start: Point, end: Point, bends: readonly Point[] = []) {
		this.start = ArrowGeometry.copy(start);
		this.end = ArrowGeometry.copy(end);
		this.bends = bends.map(ArrowGeometry.copy);
	}

	static straight(start: Point, end: Point): ArrowGeometry {
		return new ArrowGeometry(start, end);
	}

	/** Start, bends, end: every point the curve passes through. */
	get points(): readonly Point[] {
		return [this.start, ...this.bends, this.end];
	}

	/** Number of curve segments (one more than the number of bends). */
	get segmentCount(): number {
		return this.bends.length + 1;
	}

	get isBent(): boolean {
		return this.bends.length > 0;
	}

	/** Straight-line distance between start and end. */
	get chordLength(): number {
		return Math.hypot(this.end.x - this.start.x, this.end.y - this.start.y);
	}

	/** The curve as cubic Bézier segments (Catmull-Rom, see the class comment). */
	segments(): CubicSegment[] {
		const points = this.points;
		const at = (index: number) => points[Math.min(Math.max(index, 0), points.length - 1)];
		const result: CubicSegment[] = [];
		for (let i = 0; i < points.length - 1; i++) {
			const before = at(i - 1);
			const p0 = at(i);
			const p1 = at(i + 1);
			const after = at(i + 2);
			result.push({
				p0,
				c1: { x: p0.x + (p1.x - before.x) / 6, y: p0.y + (p1.y - before.y) / 6 },
				c2: { x: p1.x - (after.x - p0.x) / 6, y: p1.y - (after.y - p0.y) / 6 },
				p1,
			});
		}
		return result;
	}

	/** The point at parameter `t` ∈ [0, 1] of segment `segmentIndex`. */
	pointOn(segmentIndex: number, t: number): Point {
		const segment = this.segments()[this.requireSegment(segmentIndex)];
		return ArrowGeometry.evaluate(segment, t);
	}

	/** The middle (t = 0.5) of a segment: where its "add bend" handle sits. */
	segmentMidpoint(segmentIndex: number): Point {
		return this.pointOn(segmentIndex, 0.5);
	}

	/**
	 * Points along the whole curve, `perSegment` per segment, from exactly
	 * `start` to exactly `end` (`perSegment * segmentCount + 1` points).
	 */
	sample(perSegment = 16): Point[] {
		const steps = Math.max(1, Math.floor(perSegment));
		const result: Point[] = [this.start];
		for (const segment of this.segments()) {
			for (let step = 1; step <= steps; step++) {
				result.push(step === steps ? segment.p1 : ArrowGeometry.evaluate(segment, step / steps));
			}
		}
		return result;
	}

	/**
	 * Unit direction of the curve at its end (where the arrowhead points).
	 * Falls back to the direction from start to end, and to +x for an arrow
	 * whose points all coincide.
	 */
	endTangent(): Point {
		const last = this.segments()[this.segmentCount - 1];
		const candidates = [
			{ x: last.p1.x - last.c2.x, y: last.p1.y - last.c2.y },
			{ x: this.end.x - this.start.x, y: this.end.y - this.start.y },
		];
		for (const vector of candidates) {
			const length = Math.hypot(vector.x, vector.y);
			if (length > 1e-9) {
				return { x: vector.x / length, y: vector.y / length };
			}
		}
		return { x: 1, y: 0 };
	}

	/** Axis-aligned bounds of the drawn curve (from a fine sampling). */
	bounds(): SceneRect {
		const points = this.sample(ArrowGeometry.BOUNDS_SAMPLES);
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);
		const x = Math.min(...xs);
		const y = Math.min(...ys);
		return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
	}

	/** Every point moved by (dx, dy). */
	translate(dx: number, dy: number): ArrowGeometry {
		const move = (point: Point) => ({ x: point.x + dx, y: point.y + dy });
		return new ArrowGeometry(move(this.start), move(this.end), this.bends.map(move));
	}

	/**
	 * The largest part of the move (dx, dy) that keeps every point inside
	 * `rect` (per axis), so the arrow keeps its shape while it is moved. An
	 * arrow that is already (partly) outside may still move back inside but
	 * never further out.
	 */
	constrainTranslation(dx: number, dy: number, rect: SceneRect): Point {
		const xs = this.points.map((point) => point.x);
		const ys = this.points.map((point) => point.y);
		const limit = (delta: number, low: number, high: number) =>
			Math.min(Math.max(delta, Math.min(low, 0)), Math.max(high, 0));
		return {
			x: limit(dx, rect.x - Math.min(...xs), rect.x + rect.width - Math.max(...xs)),
			y: limit(dy, rect.y - Math.min(...ys), rect.y + rect.height - Math.max(...ys)),
		};
	}

	/** Moved by (dx, dy), but only as far as every point stays inside `rect` (see `constrainTranslation`). */
	translateWithin(dx: number, dy: number, rect: SceneRect): ArrowGeometry {
		const delta = this.constrainTranslation(dx, dy, rect);
		return this.translate(delta.x, delta.y);
	}

	/** Every point clamped into `rect`. */
	clampedTo(rect: SceneRect): ArrowGeometry {
		const clamp = (point: Point) => ({
			x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
			y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height),
		});
		return new ArrowGeometry(clamp(this.start), clamp(this.end), this.bends.map(clamp));
	}

	withStart(start: Point): ArrowGeometry {
		return new ArrowGeometry(start, this.end, this.bends);
	}

	withEnd(end: Point): ArrowGeometry {
		return new ArrowGeometry(this.start, end, this.bends);
	}

	withBendMoved(bendIndex: number, point: Point): ArrowGeometry {
		this.requireBend(bendIndex);
		return new ArrowGeometry(
			this.start,
			this.end,
			this.bends.map((bend, index) => (index === bendIndex ? point : bend)),
		);
	}

	/**
	 * Inserts a bend into segment `segmentIndex` (between `points[segmentIndex]`
	 * and `points[segmentIndex + 1]`); it becomes bend number `segmentIndex`.
	 */
	withBendInserted(segmentIndex: number, point: Point): ArrowGeometry {
		this.requireSegment(segmentIndex);
		return new ArrowGeometry(this.start, this.end, [
			...this.bends.slice(0, segmentIndex),
			point,
			...this.bends.slice(segmentIndex),
		]);
	}

	withBendRemoved(bendIndex: number): ArrowGeometry {
		this.requireBend(bendIndex);
		return new ArrowGeometry(
			this.start,
			this.end,
			this.bends.filter((_, index) => index !== bendIndex),
		);
	}

	/** The straight arrow from start to end (all bends removed). */
	straightened(): ArrowGeometry {
		return this.isBent ? new ArrowGeometry(this.start, this.end) : this;
	}

	equals(other: ArrowGeometry): boolean {
		return (
			samePoint(this.start, other.start) &&
			samePoint(this.end, other.end) &&
			this.bends.length === other.bends.length &&
			this.bends.every((bend, index) => samePoint(bend, other.bends[index]))
		);
	}

	private requireSegment(segmentIndex: number): number {
		if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= this.segmentCount) {
			throw new RangeError(`Arrow has no segment ${segmentIndex} (it has ${this.segmentCount})`);
		}
		return segmentIndex;
	}

	private requireBend(bendIndex: number): void {
		if (!Number.isInteger(bendIndex) || bendIndex < 0 || bendIndex >= this.bends.length) {
			throw new RangeError(`Arrow has no bend ${bendIndex} (it has ${this.bends.length})`);
		}
	}

	private static evaluate(segment: CubicSegment, t: number): Point {
		const u = 1 - t;
		const a = u * u * u;
		const b = 3 * u * u * t;
		const c = 3 * u * t * t;
		const d = t * t * t;
		return {
			x: a * segment.p0.x + b * segment.c1.x + c * segment.c2.x + d * segment.p1.x,
			y: a * segment.p0.y + b * segment.c1.y + c * segment.c2.y + d * segment.p1.y,
		};
	}

	private static copy(point: Point): Point {
		return { x: point.x, y: point.y };
	}
}
