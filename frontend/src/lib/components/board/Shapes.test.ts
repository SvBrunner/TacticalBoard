import { describe, it, expect, vi } from "vitest";
import {
	drawPlayer,
	drawBall,
	drawRectangle,
	drawTriangle,
	drawCircle,
	drawFunctionFor,
	drawHitCircle,
	visualRadius,
} from "./Shapes";
import { ELEMENT_TYPES, type ElementType } from "$lib/model/elements/ElementType";

function createMockContext() {
	return {
		beginPath: vi.fn(),
		closePath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		rect: vi.fn(),
		arc: vi.fn(),
		fill: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		fillStrokeShape: vi.fn(),
		globalCompositeOperation: "",
	};
}

describe.each([
	["drawPlayer", drawPlayer],
	["drawBall", drawBall],
	["drawRectangle", drawRectangle],
	["drawTriangle", drawTriangle],
	["drawCircle", drawCircle],
])("%s", (_name, draw) => {
	it("draws without throwing and paints the shape", () => {
		const context = createMockContext();
		const shape = {};

		expect(() => draw(context, shape)).not.toThrow();

		expect(context.beginPath).toHaveBeenCalled();
		expect(context.closePath).toHaveBeenCalled();
		expect(context.fillStrokeShape).toHaveBeenCalledWith(shape);
	});
});

describe("shapes with a punched-out center (Ball, Rectangle, Triangle, Circle)", () => {
	it.each([
		["drawBall", drawBall],
		["drawRectangle", drawRectangle],
		["drawTriangle", drawTriangle],
		["drawCircle", drawCircle],
	])("%s uses destination-out compositing to cut the inner shape", (_name, draw) => {
		const context = createMockContext();

		draw(context, {});

		expect(context.save).toHaveBeenCalled();
		expect(context.restore).toHaveBeenCalled();
		expect(context.fill).toHaveBeenCalled();
	});
});

describe("drawFunctionFor", () => {
	it.each<[ElementType, unknown]>([
		["Player", drawPlayer],
		["Ball", drawBall],
		["Rectangle", drawRectangle],
		["Triangle", drawTriangle],
		["Circle", drawCircle],
	])("returns the draw function for %s", (type, draw) => {
		expect(drawFunctionFor(type)).toBe(draw);
	});

	it("falls back to the player drawing for an unknown type", () => {
		expect(drawFunctionFor("Unknown" as ElementType)).toBe(drawPlayer);
	});
});

describe("visualRadius", () => {
	it.each<[ElementType, number]>([
		["Player", 20],
		["Ball", 12],
		["Circle", 20],
		["Rectangle", Math.hypot(20, 20)],
		["Triangle", Math.hypot(18, 15)],
	])("%s has radius %d", (type, radius) => {
		expect(visualRadius(type)).toBeCloseTo(radius);
	});

	it.each(ELEMENT_TYPES.map((type) => [type]))("contains every point %s draws", (type) => {
		const context = createMockContext();
		drawFunctionFor(type)(context, {});
		const radius = visualRadius(type);

		const points: [number, number][] = [
			...context.moveTo.mock.calls.map(([x, y]) => [x, y] as [number, number]),
			...context.lineTo.mock.calls.map(([x, y]) => [x, y] as [number, number]),
			...context.rect.mock.calls.flatMap(([x, y, w, h]) => [
				[x, y],
				[x + w, y + h],
				[x + w, y],
				[x, y + h],
			] as [number, number][]),
		];
		for (const [x, y] of points) {
			expect(Math.hypot(x, y)).toBeLessThanOrEqual(radius + 1e-9);
		}
		for (const [, , arcRadius] of context.arc.mock.calls) {
			expect(arcRadius).toBeLessThanOrEqual(radius);
		}
	});
});

describe("drawHitCircle", () => {
	it("draws one solid circle of the given radius without cut-outs", () => {
		const context = createMockContext();
		const shape = {};

		drawHitCircle(55)(context, shape);

		expect(context.arc).toHaveBeenCalledExactlyOnceWith(0, 0, 55, 0, 2 * Math.PI);
		expect(context.fillStrokeShape).toHaveBeenCalledWith(shape);
		expect(context.globalCompositeOperation).toBe("");
		expect(context.save).not.toHaveBeenCalled();
	});
});
