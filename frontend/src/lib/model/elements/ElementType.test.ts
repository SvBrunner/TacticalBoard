import { describe, it, expect } from "vitest";
import {
	ARROW_ELEMENT_TYPES,
	ELEMENT_TYPES,
	familyOf,
	isArrowElementType,
	isElementType,
	isPointElementType,
	POINT_ELEMENT_TYPES,
	sameFamily,
} from "./ElementType";

describe("ElementType", () => {
	it("lists the point and the arrow element types", () => {
		expect(POINT_ELEMENT_TYPES).toEqual(["Player", "Ball", "Rectangle", "Triangle", "Circle"]);
		expect(ARROW_ELEMENT_TYPES).toEqual(["Pass", "Run", "Shot"]);
		expect(ELEMENT_TYPES).toEqual([...POINT_ELEMENT_TYPES, ...ARROW_ELEMENT_TYPES]);
	});

	it.each(POINT_ELEMENT_TYPES.map((type) => [type]))("accepts the point type %s", (type) => {
		expect(isElementType(type)).toBe(true);
		expect(isPointElementType(type)).toBe(true);
		expect(isArrowElementType(type)).toBe(false);
		expect(familyOf(type)).toBe("point");
	});

	it.each(ARROW_ELEMENT_TYPES.map((type) => [type]))("accepts the arrow type %s", (type) => {
		expect(isElementType(type)).toBe(true);
		expect(isArrowElementType(type)).toBe(true);
		expect(isPointElementType(type)).toBe(false);
		expect(familyOf(type)).toBe("arrow");
	});

	it.each([["player"], ["pass"], [""], [undefined], [null], [3], [{}]])("rejects %j", (value) => {
		expect(isElementType(value)).toBe(false);
		expect(isPointElementType(value)).toBe(false);
		expect(isArrowElementType(value)).toBe(false);
	});

	describe("sameFamily", () => {
		it("is true within the point types and within the arrow types", () => {
			expect(sameFamily("Player", "Circle")).toBe(true);
			expect(sameFamily("Ball", "Ball")).toBe(true);
			expect(sameFamily("Pass", "Shot")).toBe(true);
			expect(sameFamily("Run", "Run")).toBe(true);
		});

		it("is false across the families", () => {
			expect(sameFamily("Player", "Pass")).toBe(false);
			expect(sameFamily("Shot", "Triangle")).toBe(false);
		});
	});
});
