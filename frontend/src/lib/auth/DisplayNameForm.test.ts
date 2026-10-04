import { describe, it, expect } from "vitest";
import { DisplayNameForm } from "./DisplayNameForm.svelte";

describe("DisplayNameForm", () => {
	it("starts from the current name without a message", () => {
		const form = new DisplayNameForm();

		form.reset("Alice");

		expect(form.value).toBe("Alice");
		expect(form.isValid).toBe(true);
		expect(form.message).toBeNull();
		expect(form.saving).toBe(false);
	});

	it("trims the name", () => {
		const form = new DisplayNameForm();
		form.value = "  Coach  ";

		expect(form.trimmed).toBe("Coach");
	});

	it("rejects a blank name, but shows it only after a submit attempt", () => {
		const form = new DisplayNameForm();
		form.value = "   ";

		expect(form.problem).toBe("Enter a display name.");
		expect(form.message).toBeNull();
		expect(form.attemptSubmit()).toBe(false);
		expect(form.message).toBe("Enter a display name.");
	});

	it("accepts exactly the maximum length after trimming", () => {
		const form = new DisplayNameForm();
		form.value = ` ${"a".repeat(DisplayNameForm.MAX_LENGTH)} `;

		expect(form.attemptSubmit()).toBe(true);
	});

	it("rejects a too long name", () => {
		const form = new DisplayNameForm();
		form.value = "a".repeat(DisplayNameForm.MAX_LENGTH + 1);

		expect(form.attemptSubmit()).toBe(false);
		expect(form.message).toBe("Use at most 100 characters.");
	});

	it("shows a server error until the input changes", () => {
		const form = new DisplayNameForm();
		form.reset("Alice");
		form.serverError = "Not reachable.";

		expect(form.message).toBe("Not reachable.");
		form.edited();
		expect(form.message).toBeNull();
	});

	it("clears a server error on the next attempt", () => {
		const form = new DisplayNameForm();
		form.reset("Alice");
		form.serverError = "Not reachable.";

		expect(form.attemptSubmit()).toBe(true);
		expect(form.message).toBeNull();
	});

	it("forgets the attempt when reset", () => {
		const form = new DisplayNameForm();
		form.value = "";
		form.attemptSubmit();

		form.reset("");

		expect(form.message).toBeNull();
	});
});
