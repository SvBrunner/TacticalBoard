import { describe, it, expect } from "vitest";
import { LocaleRegistry } from "./LocaleRegistry";
import type { LocaleDefinition } from "./Messages";
import en from "./locales/en";
import de from "./locales/de";

const english = en as LocaleDefinition;
const french: LocaleDefinition = { code: "fr", name: "Français", messages: english.messages };

describe("LocaleRegistry", () => {
	const registry = new LocaleRegistry([english, de]);

	it("bundles every translation file: English and German", () => {
		expect(LocaleRegistry.bundled().languages()).toEqual([
			{ code: "de", name: "Deutsch" },
			{ code: "en", name: "English" },
		]);
	});

	it("has English as the fallback", () => {
		expect(LocaleRegistry.FALLBACK).toBe("en");
		expect(registry.fallback).toBe(english);
		expect(registry.get("xx")).toBe(english);
		expect(registry.get("DE")).toBe(de);
	});

	it("resolves language tags by their primary subtag, ignoring case", () => {
		expect(registry.resolve("de")).toBe("de");
		expect(registry.resolve("de-CH")).toBe("de");
		expect(registry.resolve("DE_at")).toBe("de");
		expect(registry.resolve("en-US")).toBe("en");
		expect(registry.resolve("fr")).toBeNull();
		expect(registry.resolve("")).toBeNull();
		expect(registry.resolve(null)).toBeNull();
		expect(registry.resolve(undefined)).toBeNull();
	});

	it("matches the browser's preferences: German for de*, otherwise English", () => {
		expect(registry.match(["de-CH", "en"])).toBe("de");
		expect(registry.match(["en-GB", "de"])).toBe("en");
		expect(registry.match(["fr-CH", "it"])).toBe("en");
		expect(registry.match([])).toBe("en");
	});

	it("takes the first preference it has a translation for", () => {
		expect(registry.match(["fr-CH", "de-CH"])).toBe("de");
	});

	it("a new translation file is all a language needs", () => {
		const withFrench = new LocaleRegistry([english, de, french]);

		expect(withFrench.match(["fr-CH"])).toBe("fr");
		expect(withFrench.has("fr")).toBe(true);
		expect(withFrench.all()).toHaveLength(3);
	});

	it("refuses two translations of one language and a missing fallback", () => {
		expect(() => new LocaleRegistry([english, { ...english }])).toThrow(/Duplicate/);
		expect(() => new LocaleRegistry([de])).toThrow(/fallback/);
	});
});
