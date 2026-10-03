import { describe, it, expect } from "vitest";
import { ArrowGeometry } from "./ArrowGeometry";
import type { Point } from "../Point";

const start = { x: 100, y: 100 };
const end = { x: 500, y: 100 };
const straight = ArrowGeometry.straight(start, end);
const bent = new ArrowGeometry(start, end, [{ x: 200, y: 300 }, { x: 400, y: 300 }]);

function distanceToCurve(geometry: ArrowGeometry, point: Point): number {
	return Math.min(...geometry.sample(400).map((p) => Math.hypot(p.x - point.x, p.y - point.y)));
}

describe("ArrowGeometry", () => {
	describe("construction", () => {
		it("keeps start, end and the bends in order", () => {
			expect(bent.start).toEqual(start);
			expect(bent.end).toEqual(end);
			expect(bent.bends).toEqual([{ x: 200, y: 300 }, { x: 400, y: 300 }]);
			expect(bent.points).toEqual([start, { x: 200, y: 300 }, { x: 400, y: 300 }, end]);
		});

		it("copies the given points, so later changes to them don't leak in", () => {
			const mutable = { x: 1, y: 2 };
			const bends = [{ x: 3, y: 4 }];
			const geometry = new ArrowGeometry(mutable, mutable, bends);

			mutable.x = 99;
			bends[0].x = 99;
			bends.push({ x: 5, y: 5 });

			expect(geometry.start).toEqual({ x: 1, y: 2 });
			expect(geometry.bends).toEqual([{ x: 3, y: 4 }]);
		});

		it("is straight without bends and has one more segment than bends", () => {
			expect(straight.isBent).toBe(false);
			expect(straight.segmentCount).toBe(1);
			expect(bent.isBent).toBe(true);
			expect(bent.segmentCount).toBe(3);
		});

		it("measures the chord from start to end", () => {
			expect(straight.chordLength).toBe(400);
			expect(new ArrowGeometry({ x: 0, y: 0 }, { x: 3, y: 4 }).chordLength).toBe(5);
		});
	});

	describe("curve", () => {
		it("a straight arrow is a straight line: every sample lies on it", () => {
			for (const point of straight.sample(10)) {
				expect(point.y).toBeCloseTo(100);
				expect(point.x).toBeGreaterThanOrEqual(100);
				expect(point.x).toBeLessThanOrEqual(500);
			}
		});

		it("has one cubic segment per pair of neighbouring points, joined end to end", () => {
			const segments = bent.segments();

			expect(segments).toHaveLength(3);
			expect(segments.map((segment) => segment.p0)).toEqual(bent.points.slice(0, 3));
			expect(segments.map((segment) => segment.p1)).toEqual(bent.points.slice(1));
		});

		it("is smooth at every bend: the tangents on both sides line up", () => {
			const segments = bent.segments();
			for (let i = 0; i < segments.length - 1; i++) {
				const incoming = { x: segments[i].p1.x - segments[i].c2.x, y: segments[i].p1.y - segments[i].c2.y };
				const outgoing = { x: segments[i + 1].c1.x - segments[i + 1].p0.x, y: segments[i + 1].c1.y - segments[i + 1].p0.y };
				expect(incoming.x * outgoing.y - incoming.y * outgoing.x).toBeCloseTo(0);
				expect(incoming.x * outgoing.x + incoming.y * outgoing.y).toBeGreaterThan(0);
			}
		});

		it("passes exactly through every bend", () => {
			for (const bend of bent.bends) {
				expect(distanceToCurve(bent, bend)).toBeLessThan(1e-9);
			}
			expect(bent.pointOn(0, 1)).toEqual(bent.bends[0]);
			expect(bent.pointOn(1, 0)).toEqual(bent.bends[0]);
			expect(bent.pointOn(1, 1)).toEqual(bent.bends[1]);
		});

		it("sample starts at start, ends at end and has perSegment points per segment", () => {
			const samples = bent.sample(8);

			expect(samples).toHaveLength(8 * 3 + 1);
			expect(samples[0]).toEqual(start);
			expect(samples.at(-1)).toEqual(end);
			expect(samples[8]).toEqual(bent.bends[0]);
		});

		it("sample uses at least one step per segment", () => {
			expect(straight.sample(0)).toEqual([start, end]);
		});

		it("segmentMidpoint is the point at t = 0.5", () => {
			expect(straight.segmentMidpoint(0)).toEqual({ x: 300, y: 100 });
			expect(bent.segmentMidpoint(1)).toEqual(bent.pointOn(1, 0.5));
			expect(bent.segmentMidpoint(1).y).toBeCloseTo(300 + (300 - 100) / 8);
		});

		it("rejects unknown segments", () => {
			expect(() => straight.pointOn(1, 0.5)).toThrow(RangeError);
			expect(() => straight.pointOn(-1, 0.5)).toThrow(RangeError);
			expect(() => bent.segmentMidpoint(1.5)).toThrow(RangeError);
		});
	});

	describe("endTangent", () => {
		it("points along a straight arrow", () => {
			expect(straight.endTangent()).toEqual({ x: 1, y: 0 });
			const diagonal = new ArrowGeometry({ x: 0, y: 0 }, { x: 30, y: 40 }).endTangent();
			expect(diagonal.x).toBeCloseTo(0.6);
			expect(diagonal.y).toBeCloseTo(0.8);
		});

		it("comes from the last bend into the end", () => {
			const tangent = new ArrowGeometry({ x: 0, y: 0 }, { x: 100, y: 100 }, [{ x: 100, y: 0 }]).endTangent();

			expect(tangent.x).toBeCloseTo(0);
			expect(tangent.y).toBeCloseTo(1);
		});

		it("falls back to start → end when the last bend sits on the end", () => {
			const tangent = new ArrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 100, y: 0 }]).endTangent();

			expect(tangent).toEqual({ x: 1, y: 0 });
		});

		it("falls back to +x when every point coincides", () => {
			expect(new ArrowGeometry({ x: 5, y: 5 }, { x: 5, y: 5 }).endTangent()).toEqual({ x: 1, y: 0 });
		});
	});

	describe("bounds", () => {
		it("of a straight arrow spans start and end", () => {
			const bounds = straight.bounds();

			expect(bounds.x).toBeCloseTo(100);
			expect(bounds.y).toBeCloseTo(100);
			expect(bounds.width).toBeCloseTo(400);
			expect(bounds.height).toBeCloseTo(0);
		});

		it("of a bent arrow includes the bulge of the curve", () => {
			const bounds = bent.bounds();

			expect(bounds.x).toBeCloseTo(100);
			expect(bounds.y).toBeCloseTo(100);
			expect(bounds.width).toBeCloseTo(400);
			expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(300);
			expect(bounds.y + bounds.height).toBeLessThan(330);
		});
	});

	describe("moving", () => {
		it("translate moves every point and keeps the original", () => {
			const moved = bent.translate(10, -20);

			expect(moved.points).toEqual(bent.points.map((p) => ({ x: p.x + 10, y: p.y - 20 })));
			expect(bent.start).toEqual(start);
		});

		const rect = { x: 0, y: 0, width: 1000, height: 500 };

		it("translateWithin moves freely while everything stays inside", () => {
			expect(bent.translateWithin(50, 50, rect).equals(bent.translate(50, 50))).toBe(true);
		});

		it("translateWithin stops at the edge without changing the shape", () => {
			const moved = bent.translateWithin(900, -500, rect);

			expect(moved.equals(bent.translate(500, -100))).toBe(true);
		});

		it("constrainTranslation lets an arrow that is partly outside move back but not further out", () => {
			const outside = new ArrowGeometry({ x: -100, y: 100 }, { x: 200, y: 100 });

			expect(outside.constrainTranslation(-50, 0, rect)).toEqual({ x: 0, y: 0 });
			expect(outside.constrainTranslation(60, 0, rect)).toEqual({ x: 60, y: 0 });
		});

		it("clampedTo clamps every point into the rect", () => {
			const wild = new ArrowGeometry({ x: -10, y: 20 }, { x: 1200, y: 600 }, [{ x: 500, y: -5 }]);

			expect(wild.clampedTo(rect).points).toEqual([
				{ x: 0, y: 20 },
				{ x: 500, y: 0 },
				{ x: 1000, y: 500 },
			]);
		});
	});

	describe("editing", () => {
		it("withStart and withEnd replace one end and keep the bends", () => {
			expect(bent.withStart({ x: 1, y: 2 }).points).toEqual([{ x: 1, y: 2 }, ...bent.points.slice(1)]);
			expect(bent.withEnd({ x: 3, y: 4 }).points).toEqual([...bent.points.slice(0, 3), { x: 3, y: 4 }]);
		});

		it("withBendMoved moves one bend", () => {
			expect(bent.withBendMoved(1, { x: 9, y: 9 }).bends).toEqual([{ x: 200, y: 300 }, { x: 9, y: 9 }]);
			expect(() => bent.withBendMoved(2, { x: 9, y: 9 })).toThrow(RangeError);
		});

		it("withBendInserted adds a bend into the given segment", () => {
			expect(straight.withBendInserted(0, { x: 300, y: 0 }).bends).toEqual([{ x: 300, y: 0 }]);
			expect(bent.withBendInserted(0, { x: 1, y: 1 }).bends).toEqual([{ x: 1, y: 1 }, ...bent.bends]);
			expect(bent.withBendInserted(1, { x: 1, y: 1 }).bends).toEqual([bent.bends[0], { x: 1, y: 1 }, bent.bends[1]]);
			expect(bent.withBendInserted(2, { x: 1, y: 1 }).bends).toEqual([...bent.bends, { x: 1, y: 1 }]);
			expect(() => bent.withBendInserted(3, { x: 1, y: 1 })).toThrow(RangeError);
		});

		it("the inserted bend lies on the new curve", () => {
			const bend = { x: 300, y: 0 };

			expect(distanceToCurve(straight.withBendInserted(0, bend), bend)).toBeLessThan(1e-9);
		});

		it("withBendRemoved removes one bend", () => {
			expect(bent.withBendRemoved(0).bends).toEqual([{ x: 400, y: 300 }]);
			expect(bent.withBendRemoved(1).bends).toEqual([{ x: 200, y: 300 }]);
			expect(() => bent.withBendRemoved(2)).toThrow(RangeError);
			expect(() => straight.withBendRemoved(0)).toThrow(RangeError);
		});

		it("straightened removes every bend and keeps start and end", () => {
			const result = bent.straightened();

			expect(result.bends).toEqual([]);
			expect(result.start).toEqual(start);
			expect(result.end).toEqual(end);
			expect(straight.straightened()).toBe(straight);
		});

		it("never changes the original", () => {
			bent.withStart({ x: 0, y: 0 });
			bent.withBendInserted(0, { x: 0, y: 0 });
			bent.withBendRemoved(0);
			bent.straightened();

			expect(bent.points).toEqual([start, { x: 200, y: 300 }, { x: 400, y: 300 }, end]);
		});
	});

	describe("equals", () => {
		it("compares start, end and every bend", () => {
			expect(bent.equals(new ArrowGeometry(start, end, [...bent.bends]))).toBe(true);
			expect(bent.equals(straight)).toBe(false);
			expect(bent.equals(bent.withBendMoved(1, { x: 400, y: 301 }))).toBe(false);
			expect(straight.equals(straight.withEnd({ x: 500, y: 101 }))).toBe(false);
			expect(straight.equals(straight.withStart({ x: 101, y: 100 }))).toBe(false);
		});
	});
});
