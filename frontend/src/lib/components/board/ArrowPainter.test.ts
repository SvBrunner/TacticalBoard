import { describe, it, expect } from "vitest";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import type { ArrowElementType } from "$lib/model/elements/ElementType";
import type { Point } from "$lib/model/Point";
import { ArrowPainter, type ArrowCanvas } from "./ArrowPainter";

/** Records every call and property assignment, in order. */
class RecordingCanvas implements ArrowCanvas {
	readonly calls: { name: string; args: unknown[]; lineWidth: number; dash: number[] }[] = [];
	private dash: number[] = [];
	lineWidth = 1;
	lineCap: CanvasLineCap = "butt";
	lineJoin: CanvasLineJoin = "miter";
	strokeStyle: string | CanvasGradient | CanvasPattern = "";
	fillStyle: string | CanvasGradient | CanvasPattern = "";

	private record(name: string, ...args: unknown[]) {
		this.calls.push({ name, args, lineWidth: this.lineWidth, dash: [...this.dash] });
	}
	beginPath() {
		this.record("beginPath");
	}
	moveTo(x: number, y: number) {
		this.record("moveTo", x, y);
	}
	lineTo(x: number, y: number) {
		this.record("lineTo", x, y);
	}
	closePath() {
		this.record("closePath");
	}
	stroke() {
		this.record("stroke");
	}
	fill() {
		this.record("fill");
	}
	setLineDash(segments: number[]) {
		this.dash = [...segments];
		this.record("setLineDash", segments);
	}
	save() {
		this.record("save");
	}
	restore() {
		this.record("restore");
	}

	named(name: string) {
		return this.calls.filter((call) => call.name === name);
	}
}

const straight = ArrowGeometry.straight({ x: 0, y: 0 }, { x: 400, y: 0 });

function paint(type: ArrowElementType, geometry = straight, painter = new ArrowPainter()) {
	const canvas = new RecordingCanvas();
	painter.paint(canvas, geometry, type, "red");
	return canvas;
}

function distanceToLine(point: Point): number {
	return Math.abs(point.y);
}

describe("ArrowPainter", () => {
	const painter = new ArrowPainter();

	describe("line styles", () => {
		it("Pass is dashed", () => {
			const stroke = paint("Pass").named("stroke")[0];

			expect(stroke.dash.length).toBeGreaterThan(0);
			expect(stroke.lineWidth).toBe(ArrowPainter.STYLES.Pass.width);
		});

		it("Run is a solid wavy line", () => {
			const canvas = paint("Run");
			const stroke = canvas.named("stroke")[0];
			const points = painter.shaft(straight, "Run");

			expect(stroke.dash).toEqual([]);
			expect(Math.max(...points.map(distanceToLine))).toBeGreaterThan(ArrowPainter.STYLES.Run.wave!.amplitude * 0.9);
			expect(Math.max(...points.map(distanceToLine))).toBeLessThanOrEqual(ArrowPainter.STYLES.Run.wave!.amplitude + 1e-9);
			expect(canvas.named("lineTo").length).toBeGreaterThan(50);
		});

		it("Run's wave fades in at the start and out at the end", () => {
			const points = painter.shaft(straight, "Run");

			expect(points[0]).toEqual({ x: 0, y: 0 });
			expect(distanceToLine(points.at(-1)!)).toBeCloseTo(0);
		});

		it("Shot is a solid line, thicker than Pass and Run", () => {
			const stroke = paint("Shot").named("stroke")[0];

			expect(stroke.dash).toEqual([]);
			expect(stroke.lineWidth).toBe(ArrowPainter.STYLES.Shot.width);
			expect(ArrowPainter.STYLES.Shot.width).toBeGreaterThan(ArrowPainter.STYLES.Pass.width * 1.5);
			expect(ArrowPainter.STYLES.Shot.width).toBeGreaterThan(ArrowPainter.STYLES.Run.width * 1.5);
		});

		it("Pass and Shot follow the curve without a wave", () => {
			for (const type of ["Pass", "Shot"] as const) {
				expect(painter.shaft(straight, type).every((point) => distanceToLine(point) < 1e-9)).toBe(true);
			}
		});

		it("strokes and fills in the element's color and restores the context", () => {
			const canvas = paint("Pass");

			expect(canvas.strokeStyle).toBe("red");
			expect(canvas.fillStyle).toBe("red");
			expect(canvas.calls[0].name).toBe("save");
			expect(canvas.calls.at(-1)!.name).toBe("restore");
		});
	});

	describe("arrowhead", () => {
		it.each([["Pass"], ["Run"], ["Shot"]] as const)("%s gets one filled, solid triangle at the end", (type) => {
			const canvas = paint(type);
			const fills = canvas.named("fill");

			expect(fills).toHaveLength(1);
			expect(fills[0].dash).toEqual([]);
			expect(canvas.named("closePath")).toHaveLength(1);
		});

		it("is the same for all types", () => {
			const heads = (["Pass", "Run", "Shot"] as const).map(() => painter.head(straight));

			expect(heads[0]).toEqual(heads[1]);
			expect(heads[1]).toEqual(heads[2]);
		});

		it("has its tip at the end and its base across the end tangent", () => {
			const [tip, left, right] = painter.head(straight);

			expect(tip).toEqual({ x: 400, y: 0 });
			expect(left).toEqual({ x: 400 - ArrowPainter.HEAD.length, y: ArrowPainter.HEAD.halfWidth });
			expect(right).toEqual({ x: 400 - ArrowPainter.HEAD.length, y: -ArrowPainter.HEAD.halfWidth });
		});

		it("follows the curve's direction at the end", () => {
			const bent = new ArrowGeometry({ x: 0, y: 0 }, { x: 100, y: 100 }, [{ x: 100, y: 0 }]);

			const [tip, left, right] = painter.head(bent);

			expect(tip).toEqual({ x: 100, y: 100 });
			expect(left.y).toBeCloseTo(100 - ArrowPainter.HEAD.length);
			expect(right.y).toBeCloseTo(100 - ArrowPainter.HEAD.length);
		});

		it("is drawn after (on top of) the line", () => {
			const names = paint("Shot").calls.map((call) => call.name);

			expect(names.indexOf("fill")).toBeGreaterThan(names.indexOf("stroke"));
		});
	});

	describe("shaft", () => {
		it("starts at the start and stops inside the arrowhead, never beyond the tip", () => {
			const points = painter.shaft(straight, "Shot");

			expect(points[0]).toEqual({ x: 0, y: 0 });
			expect(points.at(-1)!.x).toBeCloseTo(400 - ArrowPainter.HEAD.length / 2);
		});

		it("follows a bent curve through its bends", () => {
			const bent = new ArrowGeometry({ x: 0, y: 0 }, { x: 400, y: 0 }, [{ x: 200, y: 150 }]);
			const points = painter.shaft(bent, "Pass");

			expect(points.some((point) => Math.hypot(point.x - 200, point.y - 150) < 1e-6)).toBe(true);
		});

		it("is empty for an arrow shorter than its head; only the head is drawn", () => {
			const tiny = ArrowGeometry.straight({ x: 0, y: 0 }, { x: 5, y: 0 });

			expect(painter.shaft(tiny, "Pass")).toEqual([]);
			const canvas = paint("Pass", tiny);
			expect(canvas.named("stroke")).toHaveLength(0);
			expect(canvas.named("fill")).toHaveLength(1);
		});
	});

	describe("scale", () => {
		it("multiplies widths, dashes, wave and head", () => {
			const big = new ArrowPainter(2.5);

			expect(big.style("Shot").width).toBe(ArrowPainter.STYLES.Shot.width * 2.5);
			expect(big.style("Pass").dash).toEqual(ArrowPainter.STYLES.Pass.dash.map((d) => d * 2.5));
			expect(big.style("Run").wave).toEqual({
				amplitude: ArrowPainter.STYLES.Run.wave!.amplitude * 2.5,
				wavelength: ArrowPainter.STYLES.Run.wave!.wavelength * 2.5,
			});
			expect(big.headLength).toBe(ArrowPainter.HEAD.length * 2.5);
			expect(big.headHalfWidth).toBe(ArrowPainter.HEAD.halfWidth * 2.5);
		});
	});

	it("traceCurve traces the whole sampled curve from start to end", () => {
		const canvas = new RecordingCanvas();

		painter.traceCurve(canvas, straight);

		expect(canvas.calls[0].name).toBe("beginPath");
		expect(canvas.named("moveTo")[0].args).toEqual([0, 0]);
		expect(canvas.named("lineTo").at(-1)!.args).toEqual([400, 0]);
		expect(canvas.named("stroke")).toHaveLength(0);
	});
});
