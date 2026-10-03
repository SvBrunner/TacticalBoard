import { describe, it, expect } from "vitest";
import { elementCatalog } from "./ElementCatalog";
import { LabelContrast, labelContrast } from "./LabelContrast";

describe("LabelContrast", () => {
	it.each([
		["oklch(20% 0.02 260)", "white"],
		["oklch(45% 0.01 260)", "white"],
		["oklch(55% 0.2 30)", "white"],
		["oklch(60% 0.1 200)", "black"],
		["oklch(90% 0.05 90)", "black"],
		["oklch(0.3 0.1 120)", "white"],
		["oklch(0.8 0.1 120)", "black"],
		["oklch(0.7 0.1 120 / 0.5)", "black"],
		["OKLCH(30% 0.1 120)", "white"],
	])("oklch: %s → %s text", (fill, expected) => {
		expect(labelContrast.textColorFor(fill)).toBe(expected);
	});

	it("uses dark text on every team color (they are all mid-light)", () => {
		for (const color of elementCatalog.playerColors) {
			expect(labelContrast.textColorFor(color.value)).toBe("black");
		}
	});

	it.each([
		["#000", "white"],
		["#000000", "white"],
		["#fff", "black"],
		["#FFFFFF", "black"],
		["#0000ff", "white"],
		["#ffff00", "black"],
		["#666666", "white"],
		["#777777", "black"],
		["#808080", "black"],
		["rgb(0, 0, 0)", "white"],
		["rgb(255 255 255)", "black"],
		["rgba(255, 255, 0, 0.5)", "black"],
	])("sRGB: %s → %s text", (fill, expected) => {
		expect(labelContrast.textColorFor(fill)).toBe(expected);
	});

	it.each([["red"], ["transparent"], ["hsl(0 100% 50%)"], [""], ["oklch(abc)"], ["#12"]])(
		"falls back for %j",
		(fill) => {
			expect(labelContrast.textColorFor(fill)).toBe("black");
			expect(new LabelContrast("white").textColorFor(fill)).toBe("white");
		},
	);

	it("clamps out-of-range oklch lightness", () => {
		expect(labelContrast.textColorFor("oklch(150% 0 0)")).toBe("black");
		expect(labelContrast.textColorFor("oklch(0% 0 0)")).toBe("white");
	});
});
