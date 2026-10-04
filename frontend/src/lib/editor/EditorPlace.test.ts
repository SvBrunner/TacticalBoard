import { describe, it, expect } from "vitest";
import { inFolder, TOP_LEVEL } from "$lib/storage/SaveTarget";
import type { SituationSummary } from "$lib/storage/SituationApi";
import { EditorPlace } from "./EditorPlace";

const summary: SituationSummary = {
	id: "s1",
	title: "Powerplay",
	sport: "floorball",
	fieldType: "full",
	folderId: "f1",
	revision: 1,
	createdAt: "2026-10-04T08:00:00Z",
	createdBy: { id: "u1", displayName: "Alice" },
	updatedAt: "2026-10-04T08:00:00Z",
	updatedBy: { id: "u1", displayName: "Alice" },
};

describe("EditorPlace", () => {
	it("starts new and loaded situations in the folder of the edited situation", () => {
		expect(new EditorPlace(inFolder("f1"), true).startTarget()).toEqual({ folderId: "f1" });
	});

	it("starts them at the top level when the edited situation is in no folder", () => {
		expect(new EditorPlace(TOP_LEVEL, true).startTarget()).toEqual(TOP_LEVEL);
	});

	it("starts them at the top level in local mode, whatever the place", () => {
		expect(new EditorPlace(inFolder("f1"), false).startTarget()).toEqual(TOP_LEVEL);
	});

	it("leads the badge to the folder's page while the situation is in a folder", () => {
		expect(new EditorPlace(inFolder("f/1"), true).home()).toEqual({ href: "/folders/f%2F1", inFolder: true });
	});

	it("leads the badge to the start page otherwise, and in local mode", () => {
		expect(new EditorPlace(TOP_LEVEL, true).home()).toEqual({ href: "/", inFolder: false });
		expect(new EditorPlace(inFolder("f1"), false).home()).toEqual({ href: "/", inFolder: false });
	});

	it("takes the place from the situation link: a server situation's folder, or where an unsaved one was started", () => {
		expect(EditorPlace.of({ kind: "saved", summary }, true).home().href).toBe("/folders/f1");
		expect(EditorPlace.of({ kind: "saved", summary: { ...summary, folderId: null } }, true).home().href).toBe("/");
		expect(EditorPlace.of({ kind: "unsaved", origin: "new", target: inFolder("f2") }, true).startTarget()).toEqual({ folderId: "f2" });
		expect(EditorPlace.of({ kind: "unsaved", origin: "imported", target: TOP_LEVEL }, true).startTarget()).toEqual(TOP_LEVEL);
	});
});
