import { describe, it, expect } from "vitest";
import { samePoint } from "./Point";

describe("samePoint", () => {
	it("compares both coordinates", () => {
		expect(samePoint({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
		expect(samePoint({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
		expect(samePoint({ x: 0, y: 2 }, { x: 1, y: 2 })).toBe(false);
	});
});
