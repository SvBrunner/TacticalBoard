import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import ConfirmDialog from "./ConfirmDialog.svelte";

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		title: "Discard changes?",
		message: "They will be lost.",
		confirmLabel: "Discard",
		onConfirm: vi.fn(),
		onCancel: vi.fn(),
		...overrides,
	};
}

describe("ConfirmDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup(); // unmount while the dialog API is still polyfilled
		restore();
	});

	it("is an alert dialog named by its title and described by its message", () => {
		render(ConfirmDialog, { props: props() });

		const dialog = screen.getByRole("alertdialog", { name: "Discard changes?" });
		expect(dialog.tagName).toBe("DIALOG");
		expect(dialog).toHaveAccessibleDescription("They will be lost.");
		expect(screen.getByRole("heading", { level: 2, name: "Discard changes?" })).toBeInTheDocument();
	});

	it("is not shown while closed", () => {
		const { container } = render(ConfirmDialog, { props: props({ open: false }) });

		expect(container.querySelector("dialog")?.open).toBe(false);
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("opens as a modal with focus on Cancel", () => {
		render(ConfirmDialog, { props: props() });

		expect(screen.getByRole("alertdialog")).toHaveAttribute("open");
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
	});

	it("uses the given button labels", () => {
		render(ConfirmDialog, { props: props({ confirmLabel: "Delete", cancelLabel: "Keep" }) });

		expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("type", "submit");
		expect(screen.getByRole("button", { name: "Keep" })).toHaveAttribute("type", "button");
	});

	it("uses a dialog form", () => {
		const { container } = render(ConfirmDialog, { props: props() });

		expect(container.querySelector("dialog > form")).toHaveAttribute("method", "dialog");
	});

	it("the confirm button calls onConfirm only", async () => {
		const p = props();
		render(ConfirmDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Discard" }));

		expect(p.onConfirm).toHaveBeenCalledOnce();
		expect(p.onCancel).not.toHaveBeenCalled();
	});

	it("the cancel button calls onCancel only", async () => {
		const p = props();
		render(ConfirmDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(p.onCancel).toHaveBeenCalledOnce();
		expect(p.onConfirm).not.toHaveBeenCalled();
	});

	it("Escape cancels", () => {
		const p = props();
		render(ConfirmDialog, { props: p });

		pressEscapeIn(screen.getByRole("alertdialog") as HTMLDialogElement);

		expect(p.onCancel).toHaveBeenCalledOnce();
	});

	it("opens and closes with the open prop, returning focus to the opener", async () => {
		const opener = document.createElement("button");
		document.body.appendChild(opener);
		opener.focus();
		const { rerender, container } = render(ConfirmDialog, { props: props({ open: false }) });

		await rerender(props({ open: true }));
		expect(container.querySelector("dialog")?.open).toBe(true);

		await rerender(props({ open: false }));
		expect(container.querySelector("dialog")?.open).toBe(false);
		expect(opener).toHaveFocus();
		opener.remove();
	});
});
