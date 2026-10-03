import { describe, it, expect } from "vitest";
import { FileNameSlug } from "./FileNameSlug";

describe("FileNameSlug", () => {
	it.each([
		["Powerplay vs. 2-3-1", "powerplay-vs-2-3-1"],
		["  Breakout  ", "breakout"],
		["Überzahl Ä Ö ß", "ueberzahl-ae-oe-ss"],
		["Défense côté", "defense-cote"],
		["A__B", "a-b"],
		["", ""],
		["   ", ""],
		["!!!", ""],
	])("of(%j) = %j", (title, expected) => {
		expect(FileNameSlug.of(title)).toBe(expected);
	});

	it("fileName appends the extension to the slug", () => {
		expect(FileNameSlug.fileName("Breakout 2", ".gif", "situation.gif")).toBe("breakout-2.gif");
	});

	it("fileName falls back when the title has no usable characters", () => {
		expect(FileNameSlug.fileName("???", ".gif", "situation.gif")).toBe("situation.gif");
	});
});
