import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { ConfirmationPrompt, type ConfirmationRequest } from "./ConfirmationPrompt";

const question: ConfirmationRequest = { title: "Discard changes?", message: "Sure?", confirmLabel: "Discard" };

describe("ConfirmationPrompt", () => {
	it("has nothing pending initially", () => {
		expect(get(new ConfirmationPrompt().pending)).toBeNull();
	});

	it("exposes the pending request", () => {
		const prompt = new ConfirmationPrompt();

		void prompt.request(question);

		expect(get(prompt.pending)).toEqual(question);
	});

	it.each([[true], [false]])("resolves with the answer %s and clears the pending request", async (confirmed) => {
		const prompt = new ConfirmationPrompt();
		const answer = prompt.request(question);

		prompt.answer(confirmed);

		await expect(answer).resolves.toBe(confirmed);
		expect(get(prompt.pending)).toBeNull();
	});

	it("answering without a pending request does nothing", () => {
		const prompt = new ConfirmationPrompt();

		expect(() => prompt.answer(true)).not.toThrow();
		expect(get(prompt.pending)).toBeNull();
	});

	it("only the first answer counts", async () => {
		const prompt = new ConfirmationPrompt();
		const answer = prompt.request(question);

		prompt.answer(false);
		prompt.answer(true);

		await expect(answer).resolves.toBe(false);
	});

	it("a new request answers the previous one with no", async () => {
		const prompt = new ConfirmationPrompt();
		const first = prompt.request(question);
		const second = prompt.request({ ...question, title: "Second?" });

		await expect(first).resolves.toBe(false);
		expect(get(prompt.pending)?.title).toBe("Second?");
		prompt.answer(true);
		await expect(second).resolves.toBe(true);
	});
});
