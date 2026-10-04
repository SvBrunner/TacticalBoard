import { describe, it, expect } from "vitest";
import { DELETED_USER, SavedSituationFormat } from "./SavedSituationFormat";

describe("SavedSituationFormat", () => {
	it("shows a user's display name, or 'Deleted user'", () => {
		expect(SavedSituationFormat.userName({ id: "1", displayName: "Alice" })).toBe("Alice");
		expect(SavedSituationFormat.userName({ id: "1", displayName: null })).toBe(DELETED_USER);
		expect(DELETED_USER).toBe("Deleted user");
	});

	it("shows a timestamp in the browser's locale", () => {
		const iso = "2026-10-04T08:30:00.000Z";

		expect(SavedSituationFormat.dateTime(iso)).toBe(
			new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)),
		);
		expect(SavedSituationFormat.dateTime("garbage")).toBe("garbage");
	});

	it("names the field types", () => {
		expect(SavedSituationFormat.fieldType("full")).toBe("Full field");
		expect(SavedSituationFormat.fieldType("half")).toBe("Half field");
		expect(SavedSituationFormat.fieldType("other")).toBe("other");
	});
});
