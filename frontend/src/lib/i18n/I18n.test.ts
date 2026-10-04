import { describe, it, expect, vi } from "vitest";
import { get } from "svelte/store";
import { MemoryKeyValueStorage } from "$lib/playback/KeyValueStorage";
import { I18n } from "./I18n";
import { LocaleRegistry } from "./LocaleRegistry";

function setup(stored?: string) {
	const storage = new MemoryKeyValueStorage();
	if (stored !== undefined) {
		storage.write(I18n.STORAGE_KEY, stored);
	}
	const onChange = vi.fn<(code: string) => void>();
	const i18n = new I18n(LocaleRegistry.bundled(), storage, onChange);
	return { i18n, storage, onChange };
}

describe("I18n", () => {
	it("is English until it is started", () => {
		const { i18n } = setup();

		expect(i18n.current()).toBe("en");
		expect(get(i18n.language)).toBe("en");
		expect(get(i18n.messages).common.cancel).toBe("Cancel");
	});

	it("starts with the browser's language: German for de*, without remembering it", () => {
		const { i18n, storage, onChange } = setup();

		expect(i18n.start(["de-CH", "en"])).toBe("de");

		expect(get(i18n.messages).common.cancel).toBe("Abbrechen");
		expect(i18n.currentMessages().common.cancel).toBe("Abbrechen");
		expect(onChange).toHaveBeenLastCalledWith("de");
		expect(storage.read(I18n.STORAGE_KEY)).toBeNull();
	});

	it("starts with English for any other browser language", () => {
		expect(setup().i18n.start(["fr-FR"])).toBe("en");
		expect(setup().i18n.start([])).toBe("en");
	});

	it("starts with a remembered choice over the browser's language", () => {
		expect(setup("en").i18n.start(["de-DE"])).toBe("en");
		expect(setup("de").i18n.start(["en-US"])).toBe("de");
	});

	it("ignores a remembered language it has no translation for", () => {
		expect(setup("xx").i18n.start(["de"])).toBe("de");
	});

	it("select switches and remembers the language", () => {
		const { i18n, storage, onChange } = setup();

		expect(i18n.select("de-CH")).toBe(true);

		expect(i18n.current()).toBe("de");
		expect(storage.read(I18n.STORAGE_KEY)).toBe("de");
		expect(onChange).toHaveBeenLastCalledWith("de");
	});

	it("select refuses a language without translation and changes nothing", () => {
		const { i18n, storage, onChange } = setup();

		expect(i18n.select("fr")).toBe(false);

		expect(i18n.current()).toBe("en");
		expect(storage.read(I18n.STORAGE_KEY)).toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});

	it("keeps working when the browser storage fails", () => {
		const failing = { read: () => null, write: () => false };
		const i18n = new I18n(LocaleRegistry.bundled(), failing);

		expect(i18n.select("de")).toBe(true);
		expect(i18n.current()).toBe("de");
	});

	it("knows its languages and which codes it supports", () => {
		const { i18n } = setup();

		expect(i18n.languages().map((language) => language.code)).toEqual(["de", "en"]);
		expect(i18n.supports("de-AT")).toBe(true);
		expect(i18n.supports("fr")).toBe(false);
		expect(i18n.supports(null)).toBe(false);
	});

	it("reset goes back to English without remembering", () => {
		const { i18n, storage } = setup();
		i18n.select("de");

		i18n.reset();

		expect(i18n.current()).toBe("en");
		expect(storage.read(I18n.STORAGE_KEY)).toBe("de");
	});
});
