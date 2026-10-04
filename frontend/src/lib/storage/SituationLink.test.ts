import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { SituationLink } from "./SituationLink";
import { inFolder, TOP_LEVEL } from "./SaveTarget";
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

		expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
		expect(link.saved()).toBeNull();
	});

	it("knows an imported situation", () => {
		const link = new SituationLink();

		link.startImported();

		expect(get(link.state)).toEqual({ kind: "unsaved", origin: "imported", target: TOP_LEVEL });
	});

	it("remembers where a situation was started, for its first save", () => {
		const link = new SituationLink();

		link.startNew(inFolder("f1"));
		expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: { folderId: "f1" } });

		link.startImported(inFolder("f2"));
		expect(link.current()).toEqual({ kind: "unsaved", origin: "imported", target: { folderId: "f2" } });
	});

	it("follows a move of its server situation, keeping the revision", () => {
		const link = new SituationLink();
		link.attach({ ...summary, revision: 3 });

		link.relocate("s1", "f1");
		expect(link.saved()).toEqual({ ...summary, revision: 3, folderId: "f1" });

		link.relocate("other", null);
		expect(link.saved()?.folderId).toBe("f1");
	});

	it("ignores a move while it holds an unsaved situation", () => {
		const link = new SituationLink();

		link.relocate("s1", "f1");

		expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
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
		expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
	});

	describe("place", () => {
		it("is where an unsaved situation was started", () => {
			const link = new SituationLink();
			expect(link.place()).toEqual(TOP_LEVEL);

			link.startNew(inFolder("f1"));
			expect(link.place()).toEqual({ folderId: "f1" });

			link.startImported(inFolder("f2"));
			expect(link.place()).toEqual({ folderId: "f2" });
		});

		it("is the folder (or top level) of a server situation, also after a move", () => {
			const link = new SituationLink();

			link.attach(summary);
			expect(link.place()).toEqual(TOP_LEVEL);

			link.relocate("s1", "f3");
			expect(link.place()).toEqual({ folderId: "f3" });
		});

		it("is also known for a state alone", () => {
			expect(SituationLink.placeOf({ kind: "saved", summary: { ...summary, folderId: "f4" } })).toEqual({ folderId: "f4" });
			expect(SituationLink.placeOf({ kind: "unsaved", origin: "imported", target: inFolder("f5") })).toEqual({ folderId: "f5" });
		});

		it("is the top level again after the situation was closed", () => {
			const link = new SituationLink();
			link.attach({ ...summary, folderId: "f1" });

			link.reset();

			expect(link.place()).toEqual(TOP_LEVEL);
		});
	});
});
