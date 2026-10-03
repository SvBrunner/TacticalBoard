import { describe, it, expect } from "vitest";
import { BoardViewport } from "$lib/board/BoardViewport";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { ExportResolution } from "./ExportResolution";

describe("ExportResolution", () => {
	it("offers Small, Medium and Large, smallest first, with Medium as the default", () => {
		expect(ExportResolution.ALL.map((resolution) => [resolution.id, resolution.label, resolution.longSide])).toEqual([
			["small", "Small", 600],
			["medium", "Medium", 1200],
			["large", "Large", 1800],
		]);
		expect(ExportResolution.DEFAULT).toBe(ExportResolution.MEDIUM);
	});

	it("finds a preset by id and rejects unknown ids", () => {
		expect(ExportResolution.byId("large")).toBe(ExportResolution.LARGE);
		expect(() => ExportResolution.byId("huge")).toThrow(/huge/);
	});

	it.each([
		[ExportResolution.SMALL, { width: 600, height: 300 }],
		[ExportResolution.MEDIUM, { width: 1200, height: 600 }],
		[ExportResolution.LARGE, { width: 1800, height: 900 }],
	])("sizes the full floorball field in landscape: %s", (resolution, expected) => {
		const viewport = new BoardViewport(FieldDimensions.FLOORBALL, "full");

		expect(resolution.sizeFor(viewport.contentSize)).toEqual(expected);
	});

	it("sizes the floorball half field (square) with both sides the long side", () => {
		const viewport = new BoardViewport(FieldDimensions.FLOORBALL, "half");

		expect(ExportResolution.MEDIUM.sizeFor(viewport.contentSize)).toEqual({ width: 1200, height: 1200 });
	});

	it("puts the long side vertically for a portrait (rotated) half field", () => {
		// A half of 1000 × 600 scene units, shown rotated: 600 wide, 1000 tall.
		const viewport = new BoardViewport(new FieldDimensions(2000, 600), "half");

		expect(ExportResolution.SMALL.sizeFor(viewport.contentSize)).toEqual({ width: 360, height: 600 });
	});

	it("rounds the short side to whole pixels, at least 1", () => {
		expect(ExportResolution.MEDIUM.sizeFor({ width: 3, height: 1 })).toEqual({ width: 1200, height: 400 });
		expect(ExportResolution.SMALL.sizeFor({ width: 7, height: 3 })).toEqual({ width: 600, height: 257 });
		expect(ExportResolution.SMALL.sizeFor({ width: 100000, height: 1 })).toEqual({ width: 600, height: 1 });
	});

	it("rejects empty content", () => {
		expect(() => ExportResolution.SMALL.sizeFor({ width: 0, height: 10 })).toThrow();
		expect(() => ExportResolution.SMALL.sizeFor({ width: 10, height: Number.NaN })).toThrow();
	});
});
