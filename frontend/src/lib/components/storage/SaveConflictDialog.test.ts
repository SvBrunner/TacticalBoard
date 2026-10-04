import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import SaveConflictDialog from "./SaveConflictDialog.svelte";

describe("SaveConflictDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	it("is an alert dialog that explains the conflict", () => {
		render(SaveConflictDialog, { props: { open: true, onChoose: vi.fn() } });

		const dialog = screen.getByRole("alertdialog", { name: "Saved by someone else" });
		expect(dialog).toHaveAttribute("open");
		expect(dialog).toHaveAccessibleDescription(/saved by someone else after you opened it/);
	});

	it("offers Cancel, Save as copy and Overwrite, with focus on Cancel", () => {
		render(SaveConflictDialog, { props: { open: true, onChoose: vi.fn() } });

		const buttons = screen.getAllByRole("button");
		expect(buttons.map((button) => button.textContent?.trim())).toEqual(["Cancel", "Save as copy", "Overwrite"]);
		expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
	});

	it.each([
		["Overwrite", "overwrite"],
		["Save as copy", "copy"],
		["Cancel", "cancel"],
	])("%s reports the choice %s", async (label, choice) => {
		const onChoose = vi.fn();
		render(SaveConflictDialog, { props: { open: true, onChoose } });

		await fireEvent.click(screen.getByRole("button", { name: label }));

		expect(onChoose).toHaveBeenCalledWith(choice);
	});

	it("Escape cancels", async () => {
		const onChoose = vi.fn();
		render(SaveConflictDialog, { props: { open: true, onChoose } });

		pressEscapeIn(screen.getByRole("alertdialog") as HTMLDialogElement);

		expect(onChoose).toHaveBeenCalledWith("cancel");
	});

	it("is not shown while closed", () => {
		const { container } = render(SaveConflictDialog, { props: { open: false, onChoose: vi.fn() } });

		expect(container.querySelector("dialog")?.open).toBe(false);
	});
});
