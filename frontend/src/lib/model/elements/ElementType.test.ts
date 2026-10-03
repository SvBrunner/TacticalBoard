import { describe, it, expect } from "vitest";
import { ELEMENT_TYPES, isElementType, isPointElementType, POINT_ELEMENT_TYPES } from "./ElementType";

describe("ElementType", () => {
	it("lists the point element types", () => {
		expect(POINT_ELEMENT_TYPES).toEqual(["Player", "Ball", "Rectangle", "Triangle", "Circle"]);
		expect(ELEMENT_TYPES).toEqual(POINT_ELEMENT_TYPES);
	});

	it.each(POINT_ELEMENT_TYPES.map((type) => [type]))("accepts %s", (type) => {
		expect(isElementType(type)).toBe(true);
		expect(isPointElementType(type)).toBe(true);
	});

	it.each([["Pass"], ["Run"], ["Shot"], ["player"], [""], [undefined], [3]])("rejects %j", (value) => {
		expect(isElementType(value)).toBe(false);
		expect(isPointElementType(value)).toBe(false);
	});
});
