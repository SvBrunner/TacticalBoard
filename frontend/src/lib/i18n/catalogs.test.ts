import { describe, it, expect } from "vitest";
import en from "./locales/en";
import de from "./locales/de";

/** Every key path of a catalog, with the kind of its value ("string" or the function's parameter count). */
function shape(value: unknown, path = ""): Record<string, string> {
	if (typeof value === "function") {
		return { [path]: `function/${value.length}` };
	}
	if (typeof value === "object" && value !== null) {
		return Object.assign({}, ...Object.entries(value).map(([key, item]) => shape(item, path ? `${path}.${key}` : key)));
	}
	return { [path]: typeof value };
}

describe("message catalogs", () => {
	it("German has exactly the keys of English, with the same kinds of values", () => {
		expect(shape(de.messages)).toEqual(shape(en.messages));
	});

	it("no text is empty", () => {
		for (const catalog of [en.messages, de.messages]) {
			for (const [path, kind] of Object.entries(shape(catalog))) {
				if (kind === "string") {
					const text = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], catalog);
					expect(text, path).not.toBe("");
				}
			}
		}
	});

	it("German uses the floorball terms of the docs", () => {
		expect(de.messages.elements).toMatchObject({ Player: "Spieler", Ball: "Ball", Pass: "Pass", Run: "Lauf", Shot: "Schuss" });
		expect(de.messages.situation.defaultTitle).toBe("Unbenannte Situation");
	});

	it("formats numbers in each language's notation", () => {
		expect(en.messages.exportGif.megabytes(1.25)).toBe("1.3 MB");
		expect(de.messages.exportGif.megabytes(1.25)).toBe("1,3 MB");
		expect(de.messages.playback.seconds(2)).toBe("2 s");
		expect(de.messages.playback.seconds(1.5)).toBe("1,5 s");
	});

	it("words the number of situations in a folder with the right plural form", () => {
		expect([0, 1, 2, 1200].map((count) => en.messages.folders.situationCount(count))).toEqual([
			"0 situations",
			"1 situation",
			"2 situations",
			"1,200 situations",
		]);
		expect([0, 1, 2, 1200].map((count) => de.messages.folders.situationCount(count))).toEqual([
			"0 Situationen",
			"1 Situation",
			"2 Situationen",
			"1.200 Situationen",
		]);
	});

	it("the language codes and names identify the files", () => {
		expect([en.code, en.name]).toEqual(["en", "English"]);
		expect([de.code, de.name]).toEqual(["de", "Deutsch"]);
	});
});
