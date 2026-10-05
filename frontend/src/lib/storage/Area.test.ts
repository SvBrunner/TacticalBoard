import { describe, it, expect } from "vitest";
import { areaOf, PERSONAL_AREA, sameArea, teamArea } from "./Area";

describe("Area", () => {
	it("has the personal area, which can't be changed", () => {
		expect(PERSONAL_AREA).toEqual({ kind: "personal" });
		expect(Object.isFrozen(PERSONAL_AREA)).toBe(true);
	});

	it("reads the server's area", () => {
		expect(areaOf({ kind: "personal", id: "u1" })).toBe(PERSONAL_AREA);
		expect(areaOf({ kind: "team", id: "t1" })).toEqual(teamArea("t1"));
	});

	it("compares areas", () => {
		expect(sameArea(PERSONAL_AREA, { kind: "personal" })).toBe(true);
		expect(sameArea(teamArea("t1"), teamArea("t1"))).toBe(true);
		expect(sameArea(teamArea("t1"), teamArea("t2"))).toBe(false);
		expect(sameArea(teamArea("t1"), PERSONAL_AREA)).toBe(false);
		expect(sameArea(PERSONAL_AREA, teamArea("t1"))).toBe(false);
	});
});
