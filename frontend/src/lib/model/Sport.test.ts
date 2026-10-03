import { describe, it, expect } from "vitest";
import { isSportId, SUPPORTED_SPORTS } from "./Sport";

describe("Sport", () => {
	it("supports floorball only", () => {
		expect(SUPPORTED_SPORTS).toEqual(["floorball"]);
	});

	it("isSportId accepts supported sports", () => {
		expect(isSportId("floorball")).toBe(true);
	});

	it.each([["football"], [""], [undefined], [null], [1], ["Floorball"]])("isSportId rejects %j", (value) => {
		expect(isSportId(value)).toBe(false);
	});
});
