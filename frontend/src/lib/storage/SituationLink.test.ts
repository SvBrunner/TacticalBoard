import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { SituationLink } from "./SituationLink";
import type { SituationSummary } from "./SituationApi";

const summary: SituationSummary = {
	id: "s1",
	title: "Powerplay",
	sport: "floorball",
	fieldType: "full",
	folderId: null,
	revision: 1,
	createdAt: "2026-10-04T08:00:00Z",
	createdBy: { id: "u1", displayName: "Alice" },
	updatedAt: "2026-10-04T08:00:00Z",
	updatedBy: { id: "u1", displayName: "Alice" },
};

describe("SituationLink", () => {
	it("starts as an unsaved new situation", () => {
		const link = new SituationLink();

		expect(link.current()).toEqual({ kind: "unsaved", origin: "new" });
		expect(link.saved()).toBeNull();
	});

	it("knows an imported situation", () => {
		const link = new SituationLink();

		link.startImported();

		expect(get(link.state)).toEqual({ kind: "unsaved", origin: "imported" });
	});

	it("holds the saved situation's metadata", () => {
		const link = new SituationLink();

		link.attach(summary);

		expect(link.current()).toEqual({ kind: "saved", summary });
		expect(link.saved()).toBe(summary);
	});

	it("forgets the server situation for a new one or when reset", () => {
		const link = new SituationLink();
		link.attach(summary);

		link.startNew();
		expect(link.saved()).toBeNull();

		link.attach(summary);
		link.reset();
		expect(link.current()).toEqual({ kind: "unsaved", origin: "new" });
	});
});
