import { describe, it, expect } from "vitest";
import { FieldDimensions } from "./FieldDimensions";

describe("FieldDimensions", () => {
	it("floorball is 2000 × 1000 scene units", () => {
		expect(FieldDimensions.forSport("floorball")).toMatchObject({ width: 2000, height: 1000 });
		expect(FieldDimensions.forSport("floorball")).toBe(FieldDimensions.FLOORBALL);
	});

	it.each([
		[0, 100],
		[100, 0],
		[-1, 100],
		[Number.NaN, 100],
	])("rejects non-positive dimensions %s × %s", (width, height) => {
		expect(() => new FieldDimensions(width, height)).toThrow(/positive/);
	});

	it("fullRect is the whole field", () => {
		expect(new FieldDimensions(2000, 1000).fullRect).toEqual({ x: 0, y: 0, width: 2000, height: 1000 });
	});

	it("halfRect is the right half (x from width/2 to width) in full-field coordinates", () => {
		expect(new FieldDimensions(2000, 1000).halfRect).toEqual({ x: 1000, y: 0, width: 1000, height: 1000 });
		expect(new FieldDimensions(300, 100).halfRect).toEqual({ x: 150, y: 0, width: 150, height: 100 });
	});

	it("visibleRect depends on the field type", () => {
		const field = new FieldDimensions(2000, 1000);

		expect(field.visibleRect("full")).toEqual(field.fullRect);
		expect(field.visibleRect("half")).toEqual(field.halfRect);
	});
});
