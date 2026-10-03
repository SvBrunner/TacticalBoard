import { describe, it, expect } from "vitest";
import { BoardViewport } from "./BoardViewport";

describe("BoardViewport", () => {
	const viewport = new BoardViewport(2000, 1000);

	describe("fit", () => {
		it("fits by width when the container is relatively taller than the scene", () => {
			expect(viewport.fit(1000, 800)).toEqual({ width: 1000, height: 500, scale: 0.5 });
		});

		it("fits by height when the container is relatively wider (landscape phone)", () => {
			expect(viewport.fit(800, 200)).toEqual({ width: 400, height: 200, scale: 0.2 });
		});

		it("keeps the field horizontal in a portrait container (no rotation)", () => {
			const fit = viewport.fit(360, 600);

			expect(fit.width).toBe(360);
			expect(fit.height).toBe(180);
			expect(fit.width).toBeGreaterThan(fit.height);
		});

		it("fills an exactly matching container", () => {
			expect(viewport.fit(2000, 1000)).toEqual({ width: 2000, height: 1000, scale: 1 });
		});

		it.each([
			[0, 0],
			[0, 500],
			[500, 0],
			[-10, 500],
			[Number.NaN, 500],
		])("returns an empty fit without NaN for a %s×%s container", (w, h) => {
			const fit = viewport.fit(w, h);

			expect(fit).toEqual({ width: 0, height: 0, scale: 0 });
		});

		it("uses the configured scene size", () => {
			expect(new BoardViewport(100, 100).fit(300, 200)).toEqual({ width: 200, height: 200, scale: 2 });
		});
	});

	describe("hitRadius", () => {
		it("enlarges small elements to a 44 CSS px target on small screens", () => {
			// scale 0.2: 22 px on screen = 110 scene units
			expect(viewport.hitRadius(20, 0.2)).toBeCloseTo(110);
		});

		it("keeps the visual radius when it is already large enough on screen", () => {
			expect(viewport.hitRadius(20, 2)).toBe(20);
		});

		it("is exactly 22 px on screen at the threshold", () => {
			expect(viewport.hitRadius(20, 1.1) * 1.1).toBeCloseTo(22);
		});

		it.each([[0], [-1], [Number.NaN]])("falls back to the visual radius for scale %s", (scale) => {
			expect(viewport.hitRadius(20, scale)).toBe(20);
		});
	});

	describe("clamp", () => {
		it("leaves points on the field unchanged", () => {
			expect(viewport.clamp({ x: 100, y: 200 })).toEqual({ x: 100, y: 200 });
		});

		it("clamps points beyond each edge onto the field", () => {
			expect(viewport.clamp({ x: -5, y: -1 })).toEqual({ x: 0, y: 0 });
			expect(viewport.clamp({ x: 2500, y: 1200 })).toEqual({ x: 2000, y: 1000 });
		});

		it("keeps the edges themselves", () => {
			expect(viewport.clamp({ x: 2000, y: 0 })).toEqual({ x: 2000, y: 0 });
		});
	});

	describe("screenRect", () => {
		it("returns the element's scaled bounds in viewport coordinates", () => {
			expect(viewport.screenRect({ x: 100, y: 50 }, 20, 0.5, { x: 10, y: 30 })).toEqual({
				x: 100,
				y: 70,
				width: 20,
				height: 20,
			});
		});
	});
});
