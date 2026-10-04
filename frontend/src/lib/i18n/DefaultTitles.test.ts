import { describe, it, expect } from "vitest";
import { DefaultTitles } from "./DefaultTitles";
import { LocaleRegistry } from "./LocaleRegistry";
import { defaultTitles } from "./index";

describe("DefaultTitles", () => {
	const titles = new DefaultTitles(LocaleRegistry.bundled().all());

	it("knows the default title of every language, ignoring case and surrounding spaces", () => {
		expect(titles.matches("Untitled Situation")).toBe(true);
		expect(titles.matches("  unbenannte situation ")).toBe(true);
		expect(titles.matches("UNTITLED SITUATION")).toBe(true);
	});

	it("counts a blank title as a default title", () => {
		expect(titles.matches("")).toBe(true);
		expect(titles.matches("   ")).toBe(true);
	});

	it("doesn't count other titles, numbered default titles included", () => {
		expect(titles.matches("Powerplay")).toBe(false);
		expect(titles.matches("Untitled Situation (2)")).toBe(false);
	});

	it("the app has an instance over the bundled translations", () => {
		expect(defaultTitles.matches("Unbenannte Situation")).toBe(true);
	});
});
