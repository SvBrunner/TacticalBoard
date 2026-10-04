import { describe, it, expect } from "vitest";
import { de, en } from "$lib/testing/i18n";
import { SavedSituationFormat } from "./SavedSituationFormat";

describe("SavedSituationFormat", () => {
	it("shows a user's display name, or 'Deleted user' in the UI language", () => {
		expect(SavedSituationFormat.userName({ id: "1", displayName: "Alice" }, en)).toBe("Alice");
		expect(SavedSituationFormat.userName({ id: "1", displayName: null }, en)).toBe("Deleted user");
		expect(SavedSituationFormat.userName({ id: "1", displayName: null }, de)).toBe("Gelöschter Benutzer");
	});

	it("shows a timestamp in the conventions of the UI language", () => {
		const iso = "2026-10-04T08:30:00.000Z";

		for (const language of ["en", "de"]) {
			expect(SavedSituationFormat.dateTime(iso, language)).toBe(
				new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)),
			);
		}
		expect(SavedSituationFormat.dateTime(iso, "de")).toMatch(/^04\.10\.2026/);
		expect(SavedSituationFormat.dateTime("garbage", "en")).toBe("garbage");
	});

	it("names the field types in the UI language", () => {
		expect(SavedSituationFormat.fieldType("full", en)).toBe("Full field");
		expect(SavedSituationFormat.fieldType("half", en)).toBe("Half field");
		expect(SavedSituationFormat.fieldType("half", de)).toBe("Halbes Feld");
		expect(SavedSituationFormat.fieldType("other", en)).toBe("other");
	});
});
