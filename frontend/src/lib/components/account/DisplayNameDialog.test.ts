import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import type { DisplayNameChange } from "$lib/auth/AuthSession";
import DisplayNameDialog from "./DisplayNameDialog.svelte";

const USER = { id: "1", displayName: "Coach", isSystemAdministrator: false, preferredLanguage: null };

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		currentName: "Alice",
		onSave: vi.fn(async (): Promise<DisplayNameChange> => ({ ok: true, user: USER })),
		onClose: vi.fn(),
		...overrides,
	};
}

const dialog = () => screen.getByRole("dialog", { name: "Change display name" }) as HTMLDialogElement;
const input = () => screen.getByRole("textbox", { name: "Display name" }) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: "Save" });

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

describe("DisplayNameDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	describe("semantics", () => {
		it("is a dialog named by its heading with a labelled field", () => {
			render(DisplayNameDialog, { props: props() });

			expect(dialog().tagName).toBe("DIALOG");
			expect(within(dialog()).getByRole("heading", { level: 2, name: "Change display name" })).toBeInTheDocument();
			expect(input()).toHaveAttribute("maxlength", "100");
			expect(input()).toBeRequired();
		});

		it("has Save (submit) and Cancel buttons", () => {
			render(DisplayNameDialog, { props: props() });

			expect(save()).toHaveAttribute("type", "submit");
			expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
		});
	});

	it("opens with the current name and focus in the field", () => {
		render(DisplayNameDialog, { props: props() });

		expect(dialog().open).toBe(true);
		expect(input().value).toBe("Alice");
		expect(input()).toHaveFocus();
	});

	it("is not shown while closed", () => {
		const { container } = render(DisplayNameDialog, { props: props({ open: false }) });

		expect(container.querySelector("dialog")?.open).toBe(false);
	});

	it("saves the trimmed name and closes", async () => {
		const p = props();
		render(DisplayNameDialog, { props: p });

		await fireEvent.input(input(), { target: { value: "  Coach  " } });
		await fireEvent.click(save());
		await settle();

		expect(p.onSave).toHaveBeenCalledWith("Coach");
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("doesn't send a blank name and says why", async () => {
		const p = props();
		render(DisplayNameDialog, { props: p });

		await fireEvent.input(input(), { target: { value: "   " } });
		await fireEvent.click(save());
		await settle();

		expect(p.onSave).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Enter a display name.");
		expect(input()).toHaveAttribute("aria-invalid", "true");
		expect(input()).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
		expect(p.onClose).not.toHaveBeenCalled();
	});

	it("shows the server's message and stays open when saving fails", async () => {
		const p = props({ onSave: vi.fn(async (): Promise<DisplayNameChange> => ({ ok: false, message: () => "The server is not reachable." })) });
		render(DisplayNameDialog, { props: p });

		await fireEvent.click(save());
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("The server is not reachable.");
		expect(p.onClose).not.toHaveBeenCalled();
		expect(save()).toBeEnabled();
	});

	it("clears the server's message when the input changes", async () => {
		const p = props({ onSave: vi.fn(async (): Promise<DisplayNameChange> => ({ ok: false, message: () => "Nope." })) });
		render(DisplayNameDialog, { props: p });
		await fireEvent.click(save());
		await settle();

		await fireEvent.input(input(), { target: { value: "Alice B" } });

		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("disables the buttons while saving and ignores another submit", async () => {
		let finish: (result: DisplayNameChange) => void = () => undefined;
		const p = props({ onSave: vi.fn(() => new Promise<DisplayNameChange>((resolve) => (finish = resolve))) });
		render(DisplayNameDialog, { props: p });

		await fireEvent.click(save());
		expect(save()).toBeDisabled();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		await fireEvent.submit(dialog().querySelector("form")!);
		pressEscapeIn(dialog());
		finish({ ok: true, user: USER });
		await settle();

		expect(p.onSave).toHaveBeenCalledOnce();
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("Cancel closes without saving", async () => {
		const p = props();
		render(DisplayNameDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(p.onClose).toHaveBeenCalledOnce();
		expect(p.onSave).not.toHaveBeenCalled();
	});

	it("Escape closes without saving", async () => {
		const p = props();
		render(DisplayNameDialog, { props: p });

		pressEscapeIn(dialog());

		expect(p.onClose).toHaveBeenCalledOnce();
		expect(p.onSave).not.toHaveBeenCalled();
	});

	it("starts from the current name again on every opening", async () => {
		const p = props();
		const { rerender } = render(DisplayNameDialog, { props: p });
		await fireEvent.input(input(), { target: { value: "Draft" } });

		await rerender({ ...p, open: false });
		await rerender({ ...p, open: true, currentName: "Coach" });

		expect(input().value).toBe("Coach");
	});
});
