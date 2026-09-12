import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { theme, toggleTheme } from "./theme";

describe("theme store", () => {
	beforeEach(() => {
		theme.set("light");
	});

	it("defaults are restored to light before each test", () => {
		expect(get(theme)).toBe("light");
	});

	it("toggleTheme flips light to dark", () => {
		toggleTheme();
		expect(get(theme)).toBe("dark");
	});

	it("toggleTheme flips dark back to light", () => {
		toggleTheme();
		toggleTheme();
		expect(get(theme)).toBe("light");
	});
});
