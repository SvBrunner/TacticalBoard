import { describe, it, expect } from "vitest";
import { ElementCatalog, elementCatalog } from "./ElementCatalog";
import { ELEMENT_TYPES } from "$lib/model/elements/ElementType";

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

	it("disables exactly Pass, Run and Shot", () => {
		expect(catalog.kinds.filter((kind) => kind.disabled).map((kind) => kind.type)).toEqual(["Pass", "Run", "Shot"]);
	});

	it("offers every model element type as an enabled kind", () => {
		const enabled = catalog.kinds.filter((kind) => !kind.disabled).map((kind) => kind.type);

		expect([...enabled].sort()).toEqual([...ELEMENT_TYPES].sort());
	});

	it("has four named player colors, the first being the default", () => {
		expect(catalog.playerColors.map((color) => color.name)).toEqual(["Team A", "Team B", "Team C", "Team D"]);
		expect(catalog.defaultPlayerColor).toBe(catalog.playerColors[0].value);
	});

	it("has a neutral color that is not a player color", () => {
		expect(catalog.playerColors.map((color) => color.value)).not.toContain(catalog.neutralColor);
	});

	it("usableType returns the model type for enabled kinds only", () => {
		const ball = catalog.kinds.find((kind) => kind.type === "Ball")!;
		const pass = catalog.kinds.find((kind) => kind.type === "Pass")!;

		expect(catalog.usableType(ball)).toBe("Ball");
		expect(catalog.usableType(pass)).toBeUndefined();
	});

	it("exports a shared instance", () => {
		expect(elementCatalog).toBeInstanceOf(ElementCatalog);
	});
});
