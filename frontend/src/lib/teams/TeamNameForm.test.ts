import { describe, it, expect } from "vitest";
import { en } from "$lib/testing/i18n";
import { TeamNameForm } from "./TeamNameForm.svelte";

describe("TeamNameForm", () => {
	it("accepts a trimmed name of up to 64 characters", () => {
		const form = new TeamNameForm();
		form.reset("  Lions ");

		expect(form.trimmed).toBe("Lions");
		expect(form.isValid).toBe(true);
		form.value = "x".repeat(64);
		expect(form.isValid).toBe(true);
	});

	it.each([
		["", "Enter a team name."],
		["   ", "Enter a team name."],
		["x".repeat(65), "Use at most 64 characters."],
		["a\nb", "Don't use line breaks or other control characters."],
	])("rejects %j", (value, message) => {
		const form = new TeamNameForm();
		form.reset(value);

		expect(form.problem?.(en)).toBe(message);
		expect(form.message).toBeNull();
		expect(form.attemptSubmit()).toBe(false);
		expect(form.message?.(en)).toBe(message);
	});
});
