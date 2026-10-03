import { describe, it, expect } from "vitest";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { BoardViewport, type StageFit } from "./BoardViewport";

const FLOORBALL = new FieldDimensions(2000, 1000);

describe("BoardViewport", () => {
	describe("full field", () => {
		const viewport = new BoardViewport(FLOORBALL, "full");

		it("shows the whole field, unrotated", () => {
			expect(viewport.visibleRect).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
			expect(viewport.rotation).toBe(0);
		});

		it("has the field's size on screen (contentSize)", () => {
			expect(viewport.contentSize).toEqual({ width: 2000, height: 1000 });
		});

		describe("fit", () => {
			it("fits by width when the container is relatively taller than the scene", () => {
				expect(viewport.fit(1000, 800)).toEqual({ width: 1000, height: 500, scale: 0.5, rotation: 0, x: 0, y: 0 });
			});

			it("fits by height when the container is relatively wider (landscape phone)", () => {
				expect(viewport.fit(800, 200)).toMatchObject({ width: 400, height: 200, scale: 0.2 });
			});

			it("keeps the field horizontal in a portrait container (no rotation)", () => {
				const fit = viewport.fit(360, 600);

				expect(fit).toMatchObject({ width: 360, height: 180, rotation: 0 });
			});

			it("fills an exactly matching container", () => {
				expect(viewport.fit(2000, 1000)).toMatchObject({ width: 2000, height: 1000, scale: 1 });
			});

			it("has no stage offset (and no negative zero)", () => {
				const fit = viewport.fit(1000, 500);

				expect(Object.is(fit.x, 0)).toBe(true);
				expect(Object.is(fit.y, 0)).toBe(true);
			});

			it("handles a tiny container", () => {
				expect(viewport.fit(2, 2)).toMatchObject({ width: 2, height: 1, scale: 0.001 });
			});

			it.each([
				[0, 0],
				[0, 500],
				[500, 0],
				[-10, 500],
				[Number.NaN, 500],
				[500, Number.POSITIVE_INFINITY * 0],
			])("returns an empty fit without NaN for a %s×%s container", (w, h) => {
				expect(viewport.fit(w, h)).toEqual({ width: 0, height: 0, scale: 0, rotation: 0, x: 0, y: 0 });
			});

			it("uses the configured field size", () => {
				expect(new BoardViewport(new FieldDimensions(100, 100)).fit(300, 200)).toMatchObject({
					width: 200,
					height: 200,
					scale: 2,
				});
			});
		});

		describe("scene ↔ stage mapping", () => {
			const fit = viewport.fit(1000, 500); // scale 0.5

			it("scales scene points onto the stage", () => {
				expect(viewport.sceneToStage({ x: 0, y: 0 }, fit)).toEqual({ x: 0, y: 0 });
				expect(viewport.sceneToStage({ x: 2000, y: 1000 }, fit)).toEqual({ x: 1000, y: 500 });
				expect(viewport.sceneToStage({ x: 400, y: 120 }, fit)).toEqual({ x: 200, y: 60 });
			});

			it("maps stage points back to the scene", () => {
				expect(viewport.stageToScene({ x: 200, y: 60 }, fit)).toEqual({ x: 400, y: 120 });
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
	});

	describe("contentSize", () => {
		it("swaps width and height for the rotated half field", () => {
			const viewport = new BoardViewport(new FieldDimensions(2000, 800), "half");

			expect(viewport.contentSize).toEqual({ width: 800, height: 1000 });
		});
	});

	describe("half field", () => {
		const viewport = new BoardViewport(FLOORBALL, "half");

		it("shows the right half (full-field coordinates) rotated by 90°", () => {
			expect(viewport.visibleRect).toEqual({ x: 1000, y: 0, width: 1000, height: 1000 });
			expect(viewport.rotation).toBe(90);
		});

		describe("fit", () => {
			it("fits the (square) floorball half into a wide container by height", () => {
				expect(viewport.fit(1000, 500)).toEqual({ width: 500, height: 500, scale: 0.5, rotation: 90, x: 500, y: -500 });
			});

			it("fits into a tall (portrait phone) container by width", () => {
				expect(viewport.fit(360, 600)).toMatchObject({ width: 360, height: 360, scale: 0.36, rotation: 90 });
			});

			it("is portrait for a non-square half: the field's length becomes the height", () => {
				// 1000 × 400 field: the half is 500 long (x) and 400 wide (y).
				const narrow = new BoardViewport(new FieldDimensions(1000, 400), "half");

				const fit = narrow.fit(800, 1000);

				expect(fit).toMatchObject({ width: 800, height: 1000, scale: 2, rotation: 90 });
				expect(fit.height).toBeGreaterThan(fit.width);
			});

			it("handles a tiny container", () => {
				expect(viewport.fit(1, 3)).toMatchObject({ width: 1, height: 1, scale: 0.001 });
			});

			it.each([
				[0, 500],
				[500, -1],
				[Number.NaN, Number.NaN],
			])("returns an empty fit for a %s×%s container", (w, h) => {
				expect(viewport.fit(w, h)).toEqual({ width: 0, height: 0, scale: 0, rotation: 90, x: 0, y: 0 });
			});
		});

		describe("scene ↔ stage mapping", () => {
			const fit = viewport.fit(1000, 500); // 500 × 500, scale 0.5

			it.each([
				// The goal end of the half (x = 2000) is at the bottom.
				[{ x: 2000, y: 0 }, { x: 500, y: 500 }],
				[{ x: 2000, y: 1000 }, { x: 0, y: 500 }],
				// The center line (x = 1000) is at the top.
				[{ x: 1000, y: 0 }, { x: 500, y: 0 }],
				[{ x: 1000, y: 1000 }, { x: 0, y: 0 }],
				// The goal itself (x ≈ 1803, y = 500) sits bottom center.
				[{ x: 1800, y: 500 }, { x: 250, y: 400 }],
			])("maps scene %j to stage %j", (scene, stage) => {
				expect(viewport.sceneToStage(scene, fit)).toEqual(stage);
			});

			it("stageToScene is the inverse of sceneToStage", () => {
				for (const point of [
					{ x: 1234, y: 567 },
					{ x: 1000, y: 0 },
					{ x: 1999, y: 999 },
				]) {
					const back = viewport.stageToScene(viewport.sceneToStage(point, fit), fit);
					expect(back.x).toBeCloseTo(point.x);
					expect(back.y).toBeCloseTo(point.y);
				}
			});

			it("maps the stage corners onto the visible half only", () => {
				const corners = [
					{ x: 0, y: 0 },
					{ x: fit.width, y: 0 },
					{ x: 0, y: fit.height },
					{ x: fit.width, y: fit.height },
				].map((corner) => viewport.stageToScene(corner, fit));

				for (const corner of corners) {
					expect(corner.x).toBeGreaterThanOrEqual(1000);
					expect(corner.x).toBeLessThanOrEqual(2000);
					expect(Math.abs(corner.y)).toBeLessThanOrEqual(1000);
				}
			});

			it("returns the origin for an empty fit", () => {
				expect(viewport.stageToScene({ x: 5, y: 5 }, viewport.fit(0, 0))).toEqual({ x: 0, y: 0 });
			});
		});

		describe("clamp", () => {
			it("leaves points in the visible half unchanged", () => {
				expect(viewport.clamp({ x: 1500, y: 300 })).toEqual({ x: 1500, y: 300 });
			});

			it("clamps points in the hidden half to the center line", () => {
				expect(viewport.clamp({ x: 400, y: 300 })).toEqual({ x: 1000, y: 300 });
			});

			it("clamps points beyond the outer edges", () => {
				expect(viewport.clamp({ x: 2300, y: -20 })).toEqual({ x: 2000, y: 0 });
				expect(viewport.clamp({ x: 1500, y: 1200 })).toEqual({ x: 1500, y: 1000 });
			});
		});
	});

	describe("forSituation", () => {
		it.each([["full" as const], ["half" as const]])("uses the sport's field and the %s field type", (fieldType) => {
			const viewport = BoardViewport.forSituation({ sport: "floorball", fieldType });

			expect(viewport.field).toBe(FieldDimensions.FLOORBALL);
			expect(viewport.fieldType).toBe(fieldType);
		});
	});

	it("defaults to the full floorball field", () => {
		const viewport = new BoardViewport();

		expect(viewport.field).toBe(FieldDimensions.FLOORBALL);
		expect(viewport.rotation).toBe(0);
	});

	describe("hitRadius", () => {
		const viewport = new BoardViewport();

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

	describe("screenRect", () => {
		it("returns the element's scaled bounds in viewport coordinates", () => {
			const viewport = new BoardViewport();
			const fit: StageFit = viewport.fit(1000, 500); // scale 0.5

			expect(viewport.screenRect({ x: 200, y: 100 }, 20, fit, { x: 10, y: 30 })).toEqual({
				x: 100,
				y: 70,
				width: 20,
				height: 20,
			});
		});

		it("follows the rotation of the half field", () => {
			const viewport = new BoardViewport(FLOORBALL, "half");
			const fit = viewport.fit(1000, 500); // scale 0.5

			// Scene (1800, 500) is at stage (250, 400).
			expect(viewport.screenRect({ x: 1800, y: 500 }, 20, fit, { x: 10, y: 30 })).toEqual({
				x: 10 + 250 - 10,
				y: 30 + 400 - 10,
				width: 20,
				height: 20,
			});
		});
	});
});
