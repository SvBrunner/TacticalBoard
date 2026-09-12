import { describe, it, expect, vi } from "vitest";
import { drawPlayer, drawBall, drawRectangle, drawTriangle, drawCircle } from "./Shapes";

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
