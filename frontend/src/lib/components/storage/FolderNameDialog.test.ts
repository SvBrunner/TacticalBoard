import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import FolderNameDialog from "./FolderNameDialog.svelte";

type Outcome = { ok: true } | { ok: false; message: (m: unknown) => string };

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		title: "New folder",
		submitLabel: "Create",
		onSubmit: vi.fn(async (): Promise<Outcome> => ({ ok: true })),
		onClose: vi.fn(),
		...overrides,
	};
}

const dialog = (name = "New folder") => screen.getByRole("dialog", { name }) as HTMLDialogElement;
const input = () => screen.getByRole("textbox", { name: "Folder name" }) as HTMLInputElement;

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

describe("FolderNameDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	it("is a dialog named by its heading with a labelled, limited field", () => {
		render(FolderNameDialog, { props: props() });

		expect(dialog().tagName).toBe("DIALOG");
		expect(within(dialog()).getByRole("heading", { level: 2, name: "New folder" })).toBeInTheDocument();
		expect(input()).toHaveAttribute("maxlength", "64");
		expect(input()).toBeRequired();
		expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("type", "submit");
		expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
	});

	it("opens empty for a new folder, with focus in the field", () => {
		render(FolderNameDialog, { props: props() });

		expect(dialog().open).toBe(true);
		expect(input().value).toBe("");
		expect(input()).toHaveFocus();
	});

	it("opens with the current name for a rename", () => {
		render(FolderNameDialog, { props: props({ title: "Rename folder", submitLabel: "Rename", initialName: "Set pieces" }) });

		expect(dialog("Rename folder")).toBeInTheDocument();
		expect(input().value).toBe("Set pieces");
		expect(screen.getByRole("button", { name: "Rename" })).toBeInTheDocument();
	});

	it("is not shown while closed", () => {
		const { container } = render(FolderNameDialog, { props: props({ open: false }) });

		expect(container.querySelector("dialog")?.open).toBe(false);
	});

	it("submits the trimmed name and closes", async () => {
		const p = props();
		render(FolderNameDialog, { props: p });

		await fireEvent.input(input(), { target: { value: "  Set pieces " } });
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(p.onSubmit).toHaveBeenCalledWith("Set pieces");
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("doesn't send an invalid name and says why", async () => {
		const p = props();
		render(FolderNameDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(p.onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Enter a folder name.");
		expect(input()).toHaveAttribute("aria-invalid", "true");
		expect(input()).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
		expect(input()).toHaveFocus();
	});

	it("shows the server's message (e.g. a taken name) and stays open", async () => {
		const p = props({ onSubmit: vi.fn(async (): Promise<Outcome> => ({ ok: false, message: () => "A folder named “A” already exists." })) });
		render(FolderNameDialog, { props: p });

		await fireEvent.input(input(), { target: { value: "A" } });
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("A folder named “A” already exists.");
		expect(p.onClose).not.toHaveBeenCalled();

		await fireEvent.input(input(), { target: { value: "B" } });
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("disables the buttons while submitting and ignores Escape meanwhile", async () => {
		let finish: (outcome: Outcome) => void = () => undefined;
		const p = props({ onSubmit: vi.fn(() => new Promise<Outcome>((resolve) => (finish = resolve))) });
		render(FolderNameDialog, { props: p });
		await fireEvent.input(input(), { target: { value: "A" } });

		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		await fireEvent.submit(dialog().querySelector("form")!);
		pressEscapeIn(dialog());
		finish({ ok: true });
		await settle();

		expect(p.onSubmit).toHaveBeenCalledOnce();
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("Cancel and Escape close without submitting", async () => {
		const p = props();
		render(FolderNameDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		pressEscapeIn(dialog());

		expect(p.onClose).toHaveBeenCalledTimes(2);
		expect(p.onSubmit).not.toHaveBeenCalled();
	});
});
