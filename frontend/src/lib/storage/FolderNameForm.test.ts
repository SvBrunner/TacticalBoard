import { describe, it, expect } from "vitest";
import { en } from "$lib/testing/i18n";
import { FolderNameForm } from "./FolderNameForm.svelte";

describe("FolderNameForm", () => {
	it("starts from the given name without a message", () => {
		const form = new FolderNameForm();

		form.reset("Set pieces");

		expect(form.value).toBe("Set pieces");
		expect(form.isValid).toBe(true);
		expect(form.message).toBeNull();
	});

	it("trims the name", () => {
		const form = new FolderNameForm();
		form.value = "  Set pieces ";

		expect(form.trimmed).toBe("Set pieces");
	});

	it.each<[string, string]>([
		["   ", "Enter a folder name."],
		["a".repeat(101), "Use at most 100 characters."],
		["Line\nbreak", "Don't use line breaks or other control characters."],
		["Tab\tinside", "Don't use line breaks or other control characters."],
		["Del\u007f", "Don't use line breaks or other control characters."],
	])("rejects %j like the backend, shown only after a submit attempt", (value, problem) => {
		const form = new FolderNameForm();
		form.value = value;

		expect(form.problem?.(en)).toBe(problem);
		expect(form.message).toBeNull();
		expect(form.attemptSubmit()).toBe(false);
		expect(form.message?.(en)).toBe(problem);
	});

	it("accepts 100 characters and surrounding whitespace", () => {
		const form = new FolderNameForm();
		form.value = ` ${"a".repeat(100)} `;

		expect(form.attemptSubmit()).toBe(true);
	});

	it("shows a server error until the input changes", () => {
		const form = new FolderNameForm();
		form.reset("Set pieces");
		form.serverError = () => "A folder named “Set pieces” already exists. Choose another name.";

		expect(form.message?.(en)).toBe("A folder named “Set pieces” already exists. Choose another name.");
		form.edited();
		expect(form.message).toBeNull();
	});
});
