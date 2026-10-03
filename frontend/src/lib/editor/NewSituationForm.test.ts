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
		expect(NewSituationForm.fieldTypeOptions).toEqual([
			{ value: "full", label: "Full field" },
			{ value: "half", label: "Half field" },
		]);
	});

	it("uses the default title as placeholder", () => {
		expect(NewSituationForm.titlePlaceholder).toBe("Untitled Situation");
	});

	it("converts its values into the editor input", () => {
		const form = new NewSituationForm();
		form.title = "Powerplay";
		form.fieldType = "half";

		expect(form.toInput()).toEqual({ title: "Powerplay", fieldType: "half" });
	});

	it("trims the title", () => {
		const form = new NewSituationForm();
		form.title = "  Breakout  ";

		expect(form.toInput().title).toBe("Breakout");
	});

	it("allows a blank title (the editor stores the default title)", () => {
		const form = new NewSituationForm();
		form.title = "   ";

		expect(form.isValid).toBe(true);
		expect(form.toInput().title).toBe("");
	});

	it("is invalid with an unknown field type", () => {
		const form = new NewSituationForm();
		form.fieldType = "quarter" as FieldType;

		expect(form.isValid).toBe(false);
		expect(() => form.toInput()).toThrow(/field type/);
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
