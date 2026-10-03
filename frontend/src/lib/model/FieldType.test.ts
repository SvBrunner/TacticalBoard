import { describe, it, expect } from "vitest";
import { FIELD_TYPES, isFieldType } from "./FieldType";

describe("FieldType", () => {
	it("has full and half", () => {
		expect(FIELD_TYPES).toEqual(["full", "half"]);
	});

	it.each([["full"], ["half"]])("isFieldType accepts %s", (value) => {
		expect(isFieldType(value)).toBe(true);
	});

	it.each([["quarter"], [""], [undefined], [null], [0], ["Full"]])("isFieldType rejects %j", (value) => {
		expect(isFieldType(value)).toBe(false);
	});
});
