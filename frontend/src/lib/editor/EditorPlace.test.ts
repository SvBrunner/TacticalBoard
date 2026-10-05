import { describe, it, expect } from "vitest";
import { teamArea } from "$lib/storage/Area";
import { inFolder, teamTopLevel, TOP_LEVEL } from "$lib/storage/SaveTarget";
import { summaryOf } from "$lib/testing/storageFakes";
import { EditorPlace } from "./EditorPlace";

const summary = summaryOf({ id: "s1", folderId: "f1" });

describe("EditorPlace", () => {
	it("starts new and loaded situations in the folder of the edited situation", () => {
		expect(new EditorPlace(inFolder("f1"), true).startTarget()).toEqual(inFolder("f1"));
		expect(new EditorPlace(inFolder("f1", teamArea("t1")), true).startTarget()).toEqual(inFolder("f1", teamArea("t1")));
	});

	it("starts them at the top level of the edited situation's area when it is in no folder", () => {
		expect(new EditorPlace(TOP_LEVEL, true).startTarget()).toEqual(TOP_LEVEL);
		expect(new EditorPlace(teamTopLevel("t1"), true).startTarget()).toEqual(teamTopLevel("t1"));
	});

	it("starts them at the top level in local mode, whatever the place", () => {
		expect(new EditorPlace(inFolder("f1"), false).startTarget()).toEqual(TOP_LEVEL);
		expect(new EditorPlace(teamTopLevel("t1"), false).startTarget()).toEqual(TOP_LEVEL);
	});

	it("starts them at the top level of the personal area when the place may only be read", () => {
		expect(new EditorPlace(inFolder("f1", teamArea("t1")), true, false).startTarget()).toEqual(TOP_LEVEL);
		expect(new EditorPlace(teamTopLevel("t1"), true, false).startTarget()).toEqual(TOP_LEVEL);
	});

	it("leads the badge to the folder's page while the situation is in a folder, also a team's", () => {
		expect(new EditorPlace(inFolder("f/1"), true).home()).toEqual({ href: "/folders/f%2F1", kind: "folder" });
		expect(new EditorPlace(inFolder("f1", teamArea("t1")), true, false).home()).toEqual({ href: "/folders/f1", kind: "folder" });
	});

	it("leads the badge to the team's page for a team situation at the top level, also for a Reader", () => {
		expect(new EditorPlace(teamTopLevel("t/1"), true).home()).toEqual({ href: "/teams/t%2F1", kind: "team" });
		expect(new EditorPlace(teamTopLevel("t1"), true, false).home()).toEqual({ href: "/teams/t1", kind: "team" });
	});

	it("leads the badge to the start page otherwise, and in local mode", () => {
		expect(new EditorPlace(TOP_LEVEL, true).home()).toEqual({ href: "/", kind: "start" });
		expect(new EditorPlace(inFolder("f1"), false).home()).toEqual({ href: "/", kind: "start" });
		expect(new EditorPlace(teamTopLevel("t1"), false).home()).toEqual({ href: "/", kind: "start" });
	});

	it("takes the place from the situation link: a server situation's area and folder, or where an unsaved one was started", () => {
		expect(EditorPlace.of({ kind: "saved", summary }, true).home().href).toBe("/folders/f1");
		expect(EditorPlace.of({ kind: "saved", summary: { ...summary, folderId: null } }, true).home().href).toBe("/");
		expect(EditorPlace.of({ kind: "unsaved", origin: "new", target: inFolder("f2") }, true).startTarget()).toEqual(inFolder("f2"));
		expect(EditorPlace.of({ kind: "unsaved", origin: "imported", target: TOP_LEVEL }, true).startTarget()).toEqual(TOP_LEVEL);
		const teamSituation = { ...summary, folderId: null, area: { kind: "team" as const, id: "t1" } };
		expect(EditorPlace.of({ kind: "saved", summary: teamSituation }, true).home().href).toBe("/teams/t1");
		expect(EditorPlace.of({ kind: "saved", summary: teamSituation }, true).startTarget()).toEqual(teamTopLevel("t1"));
		expect(EditorPlace.of({ kind: "saved", summary: { ...teamSituation, canWrite: false } }, true).startTarget()).toEqual(TOP_LEVEL);
	});
});
