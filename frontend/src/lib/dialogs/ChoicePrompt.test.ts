import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { ChoicePrompt } from "./ChoicePrompt";

type Choice = "a" | "b" | "cancel";

describe("ChoicePrompt", () => {
	it("shows the request until it is answered, then resolves with the answer", async () => {
		const prompt = new ChoicePrompt<string, Choice>("cancel");

		const answer = prompt.request("Which one?");
		expect(get(prompt.pending)).toBe("Which one?");
		prompt.answer("b");

		await expect(answer).resolves.toBe("b");
		expect(get(prompt.pending)).toBeNull();
	});

	it("dismissing answers with the safe choice", async () => {
		const prompt = new ChoicePrompt<string, Choice>("cancel");

		const answer = prompt.request("Which one?");
		prompt.dismiss();

		await expect(answer).resolves.toBe("cancel");
	});

	it("a new request dismisses the pending one", async () => {
		const prompt = new ChoicePrompt<string, Choice>("cancel");

		const first = prompt.request("First?");
		const second = prompt.request("Second?");

		await expect(first).resolves.toBe("cancel");
		expect(get(prompt.pending)).toBe("Second?");
		prompt.answer("a");
		await expect(second).resolves.toBe("a");
	});

	it("ignores answers when nothing is asked", () => {
		const prompt = new ChoicePrompt<string, Choice>("cancel");

		expect(() => prompt.answer("a")).not.toThrow();
		expect(get(prompt.pending)).toBeNull();
	});
});
