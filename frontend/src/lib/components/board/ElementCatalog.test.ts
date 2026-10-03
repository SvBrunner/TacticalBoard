import { describe, it, expect } from "vitest";
import { ElementCatalog, elementCatalog } from "./ElementCatalog";
import { ARROW_ELEMENT_TYPES, ELEMENT_TYPES, POINT_ELEMENT_TYPES } from "$lib/model/elements/ElementType";

describe("ElementCatalog", () => {
	const catalog = new ElementCatalog();

	it("lists all kinds in display order", () => {
		expect(catalog.kinds.map((kind) => kind.type)).toEqual([
			"Player",
			"Ball",
			"Pass",
			"Run",
			"Shot",
			"Rectangle",
			"Triangle",
			"Circle",
		]);
	});

	it("offers every model element type exactly once, named after it", () => {
		expect(catalog.kinds.map((kind) => kind.type).sort()).toEqual([...ELEMENT_TYPES].sort());
		expect(catalog.kinds.every((kind) => kind.name === kind.type)).toBe(true);
	});

	it("kindsLike returns the kinds of the same family, in display order", () => {
		expect(catalog.kindsLike("Circle").map((kind) => kind.type)).toEqual(["Player", "Ball", "Rectangle", "Triangle", "Circle"]);
		expect(catalog.kindsLike("Pass").map((kind) => kind.type)).toEqual(["Pass", "Run", "Shot"]);
		expect([...catalog.kindsLike("Player").map((kind) => kind.type)].sort()).toEqual([...POINT_ELEMENT_TYPES].sort());
		expect([...catalog.kindsLike("Shot").map((kind) => kind.type)].sort()).toEqual([...ARROW_ELEMENT_TYPES].sort());
	});

	it("has four named player colors, the first being the default", () => {
		expect(catalog.playerColors.map((color) => color.name)).toEqual(["Team A", "Team B", "Team C", "Team D"]);
		expect(catalog.defaultPlayerColor).toBe(catalog.playerColors[0].value);
	});

	it("has a neutral color and a black arrow color that are not player colors", () => {
		const playerValues = catalog.playerColors.map((color) => color.value);

		expect(playerValues).not.toContain(catalog.neutralColor);
		expect(playerValues).not.toContain(catalog.arrowColor);
		expect(catalog.arrowColor).not.toBe(catalog.neutralColor);
	});

	it("offers the player colors, grey and black as the edit palette, so every initial color is in it", () => {
		expect(catalog.colors.map((color) => color.name)).toEqual(["Team A", "Team B", "Team C", "Team D", "Grey", "Black"]);
		const values = catalog.colors.map((color) => color.value);
		expect(values).toContain(catalog.neutralColor);
		expect(values).toContain(catalog.arrowColor);
		expect(new Set(values).size).toBe(values.length);
	});

	it("colorName names palette colors and falls back to the value", () => {
		expect(catalog.colorName(catalog.arrowColor)).toBe("Black");
		expect(catalog.colorName("oklch(64% 0.16 32)")).toBe("Team B");
		expect(catalog.colorName("hotpink")).toBe("hotpink");
	});

	it("exports a shared instance", () => {
		expect(elementCatalog).toBeInstanceOf(ElementCatalog);
	});
});
