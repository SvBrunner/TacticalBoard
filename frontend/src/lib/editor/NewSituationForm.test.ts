import { describe, it, expect } from "vitest";
import type { FieldType } from "$lib/model/FieldType";
import { NewSituationForm } from "./NewSituationForm.svelte";

describe("NewSituationForm", () => {
	it("defaults to an empty title and the full field", () => {
		const form = new NewSituationForm();

		expect(form.title).toBe("");
		expect(form.fieldType).toBe("full");
		expect(NewSituationForm.DEFAULT_FIELD_TYPE).toBe("full");
	});

	it("offers full and half field, full first", () => {
		expect(NewSituationForm.fieldTypeOptions).toEqual([{ value: "full" }, { value: "half" }]);
	});

	it("converts its values into the editor input", () => {
		const form = new NewSituationForm();
		form.title = "Powerplay";
		form.fieldType = "half";

		expect(form.toInput("Untitled Situation")).toEqual({ title: "Powerplay", fieldType: "half" });
	});

	it("trims the title", () => {
		const form = new NewSituationForm();
		form.title = "  Breakout  ";

		expect(form.toInput("Untitled Situation").title).toBe("Breakout");
	});

	it("allows a blank title, which becomes the given default title (that of the UI language)", () => {
		const form = new NewSituationForm();
		form.title = "   ";

		expect(form.isValid).toBe(true);
		expect(form.toInput("Untitled Situation").title).toBe("Untitled Situation");
		expect(form.toInput("Unbenannte Situation").title).toBe("Unbenannte Situation");
	});

	it("is invalid with an unknown field type", () => {
		const form = new NewSituationForm();
		form.fieldType = "quarter" as FieldType;

		expect(form.isValid).toBe(false);
		expect(() => form.toInput("Untitled Situation")).toThrow(/field type/);
	});

	it("reset restores the defaults", () => {
		const form = new NewSituationForm();
		form.title = "x";
		form.fieldType = "half";

		form.reset();

		expect(form.title).toBe("");
		expect(form.fieldType).toBe("full");
	});
});
