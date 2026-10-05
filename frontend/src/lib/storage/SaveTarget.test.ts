import { describe, it, expect } from "vitest";
import { PERSONAL_AREA, teamArea } from "./Area";
import { inFolder, teamTopLevel, TOP_LEVEL } from "./SaveTarget";

describe("SaveTarget", () => {
	it("has the top level of the personal area, which can't be changed", () => {
		expect(TOP_LEVEL).toEqual({ area: PERSONAL_AREA, folderId: null });
		expect(Object.isFrozen(TOP_LEVEL)).toBe(true);
	});

	it("names a folder of the personal area or of a team", () => {
		expect(inFolder("f1")).toEqual({ area: PERSONAL_AREA, folderId: "f1" });
		expect(inFolder("f1", teamArea("t1"))).toEqual({ area: { kind: "team", teamId: "t1" }, folderId: "f1" });
	});

	it("names the top level of a team", () => {
		expect(teamTopLevel("t1")).toEqual({ area: { kind: "team", teamId: "t1" }, folderId: null });
	});
});
