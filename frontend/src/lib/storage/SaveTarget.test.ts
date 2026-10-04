import { describe, it, expect } from "vitest";
import { inFolder, TOP_LEVEL } from "./SaveTarget";

describe("SaveTarget", () => {
	it("has the top level of the personal area, which can't be changed", () => {
		expect(TOP_LEVEL).toEqual({ folderId: null });
		expect(Object.isFrozen(TOP_LEVEL)).toBe(true);
	});

	it("names a folder", () => {
		expect(inFolder("f1")).toEqual({ folderId: "f1" });
	});
});
