import { describe, it, expect } from "vitest";
import { PositionCatalog } from "./PositionCatalog";
import { de, en } from "$lib/testing/i18n";

describe("PositionCatalog", () => {
	const floorball = PositionCatalog.forSport("floorball");

	it("lists the floorball positions in order with code and full name", () => {
		expect(floorball.positions).toEqual([
			{ code: "G" },
			{ code: "V" },
			{ code: "C" },
			{ code: "F" },
			{ code: "LV" },
			{ code: "RV" },
			{ code: "LF" },
			{ code: "RF" },
		]);
	});

	it("names the positions in the given catalog's language, falling back to the code", () => {
		expect(floorball.sport).toBe("floorball");
		expect(floorball.nameOf("LV", en.positions)).toBe("Left defender");
		expect(floorball.nameOf("LV", de.positions)).toBe("Linker Verteidiger");
		expect(floorball.nameOf("G", de.positions)).toBe("Goalie");
		expect(floorball.nameOf("10", en.positions)).toBe("10");
		for (const position of floorball.positions) {
			expect(en.positions.floorball).toHaveProperty(position.code);
			expect(de.positions.floorball).toHaveProperty(position.code);
		}
	});

	it("every predefined code is a valid label", () => {
		for (const position of floorball.positions) {
			expect(PositionCatalog.isValidLabel(position.code)).toBe(true);
			expect(PositionCatalog.normalize(position.code)).toBe(position.code);
		}
	});

	it("find returns the predefined position for a code, exact match only", () => {
		expect(floorball.find("LV")).toEqual({ code: "LV" });
		expect(floorball.find("lv")).toBeUndefined();
		expect(floorball.find("10")).toBeUndefined();
		expect(floorball.find("")).toBeUndefined();
	});

	describe("isValidLabel", () => {
		it.each([[""], ["C"], ["LV"], ["10"], ["7"], ["a"], ["c1"], ["Ü"], ["ÄÖ"]])("accepts %j", (label) => {
			expect(PositionCatalog.isValidLabel(label)).toBe(true);
		});

		it.each([["ABC"], ["123"], [" C"], ["C "], ["-"], ["L-"], ["#1"], ["😀"], ["Ä"], [undefined], [null], [1], [{}]])(
			"rejects %j",
			(label) => {
				expect(PositionCatalog.isValidLabel(label)).toBe(false);
			},
		);

		it("counts characters, not UTF-16 code units", () => {
			// U+1D400 MATHEMATICAL BOLD CAPITAL A is a letter outside the BMP.
			expect(PositionCatalog.isValidLabel("\u{1D400}\u{1D400}")).toBe(true);
			expect(PositionCatalog.isValidLabel("\u{1D400}\u{1D400}\u{1D400}")).toBe(false);
		});
	});

	describe("normalize", () => {
		it.each([
			["c", "C"],
			["lv", "LV"],
			["Rf", "RF"],
			["10", "10"],
			["abc", "AB"],
			[" c ", "C"],
			["l-v", "LV"],
			["#9", "9"],
			["", ""],
			["--", ""],
			["ü", "Ü"],
			["Ä", "Ä"],
			["ß", "ß"],
		])("%j becomes %j", (raw, expected) => {
			expect(PositionCatalog.normalize(raw)).toBe(expected);
			expect(PositionCatalog.isValidLabel(PositionCatalog.normalize(raw))).toBe(true);
		});
	});
});
