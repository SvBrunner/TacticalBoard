import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
import { i18n } from "$lib/i18n";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import PromptDialog from "./PromptDialog.svelte";

describe("PromptDialog", () => {
	let restore: () => void;
	let prompt: ConfirmationPrompt;

	beforeEach(() => {
		restore = installDialogPolyfill();
		prompt = new ConfirmationPrompt();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	function ask() {
		return prompt.request({
			title: (m) => m.saved.deleteQuestion,
			message: (m) => m.saved.deleteMessage("Powerplay"),
			confirmLabel: (m) => m.common.delete,
			cancelLabel: (m) => m.common.cancel,
		});
	}

	it("shows nothing without a question", () => {
		render(PromptDialog, { props: { prompt } });

		expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
	});

	it("shows the prompt's question and answers yes with its confirm button", async () => {
		render(PromptDialog, { props: { prompt } });
		const answer = ask();
		await tick();

		const dialog = screen.getByRole("alertdialog", { name: "Delete situation?" });
		expect(dialog).toHaveAccessibleDescription("“Powerplay” will be deleted.");
		await fireEvent.click(screen.getByRole("button", { name: "Delete" }));

		await expect(answer).resolves.toBe(true);
	});

	it("answers no with Cancel, and words the question in the UI language", async () => {
		i18n.select("de");
		render(PromptDialog, { props: { prompt } });
		const answer = ask();
		await tick();

		expect(screen.getByRole("alertdialog", { name: "Situation löschen?" })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

		await expect(answer).resolves.toBe(false);
	});
});
