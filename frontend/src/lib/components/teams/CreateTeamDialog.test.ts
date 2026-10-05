import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import CreateTeamDialog from "./CreateTeamDialog.svelte";

type Outcome = { ok: true } | { ok: false; message: (m: unknown) => string };

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		onSubmit: vi.fn(async (): Promise<Outcome> => ({ ok: true })),
		onClose: vi.fn(),
		...overrides,
	};
}

const dialog = () => screen.getByRole("dialog", { name: "Create team" }) as HTMLDialogElement;
const nameInput = () => screen.getByRole("textbox", { name: "Team name" }) as HTMLInputElement;

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

async function pick(file: File) {
	const input = dialog().querySelector<HTMLInputElement>("input[type=file]")!;
	Object.defineProperty(input, "files", { value: [file], configurable: true });
	await fireEvent.change(input);
	await tick();
}

const png = new File([new Uint8Array(4)], "lions.png", { type: "image/png" });

describe("CreateTeamDialog", () => {
	let restore: () => void;
	const original = {
		createObjectURL: URL.createObjectURL,
		revokeObjectURL: URL.revokeObjectURL,
	};
	let revoked: string[];

	beforeEach(() => {
		restore = installDialogPolyfill();
		revoked = [];
		Object.assign(URL, {
			createObjectURL: () => "blob:preview",
			revokeObjectURL: (url: string) => revoked.push(url),
		});
	});

	afterEach(() => {
		cleanup();
		restore();
		Object.assign(URL, original);
	});

	it("is a dialog named by its heading, with a limited name field and the logo picker", () => {
		render(CreateTeamDialog, { props: props() });

		expect(dialog().tagName).toBe("DIALOG");
		expect(within(dialog()).getByRole("heading", { level: 2, name: "Create team" })).toBeInTheDocument();
		expect(nameInput()).toHaveAttribute("maxlength", "64");
		expect(nameInput()).toBeRequired();
		expect(nameInput()).toHaveFocus();
		expect(within(dialog()).getByRole("group", { name: "Logo (optional)" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("type", "submit");
	});

	it("is not shown while closed", () => {
		const { container } = render(CreateTeamDialog, {
			props: props({ open: false }),
		});

		expect(container.querySelector("dialog")?.open).toBe(false);
	});

	it("creates with the trimmed name and without a logo", async () => {
		const p = props();
		render(CreateTeamDialog, { props: p });

		await fireEvent.input(nameInput(), { target: { value: "  Lions " } });
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(p.onSubmit).toHaveBeenCalledWith("Lions", null);
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("creates with the chosen logo, previewed before, and frees the preview afterwards", async () => {
		const p = props();
		render(CreateTeamDialog, { props: p });

		await fireEvent.input(nameInput(), { target: { value: "Lions" } });
		await pick(png);
		expect(within(dialog()).getByRole("img", { name: "Preview of the logo" })).toHaveAttribute("src", "blob:preview");
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(p.onSubmit).toHaveBeenCalledWith("Lions", png);
		expect(revoked).toEqual(["blob:preview"]);
	});

	it("doesn't send an invalid name and says why", async () => {
		const p = props();
		render(CreateTeamDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(p.onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Enter a team name.");
		expect(nameInput()).toHaveAttribute("aria-invalid", "true");
	});

	it("doesn't send while the chosen file can't be a logo", async () => {
		const p = props();
		render(CreateTeamDialog, { props: p });

		await fireEvent.input(nameInput(), { target: { value: "Lions" } });
		await pick(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(p.onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Choose a PNG, JPEG or WebP image.");
	});

	it("shows the server's message (e.g. a taken name) and stays open", async () => {
		const p = props({
			onSubmit: vi.fn(async (): Promise<Outcome> => ({
				ok: false,
				message: () => "A team named “Lions” already exists.",
			})),
		});
		render(CreateTeamDialog, { props: p });

		await fireEvent.input(nameInput(), { target: { value: "Lions" } });
		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("A team named “Lions” already exists.");
		expect(p.onClose).not.toHaveBeenCalled();
		await fireEvent.input(nameInput(), { target: { value: "Tigers" } });
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("disables the buttons while creating and ignores Escape meanwhile", async () => {
		let finish: (outcome: Outcome) => void = () => undefined;
		const p = props({
			onSubmit: vi.fn(() => new Promise<Outcome>((resolve) => (finish = resolve))),
		});
		render(CreateTeamDialog, { props: p });
		await fireEvent.input(nameInput(), { target: { value: "Lions" } });

		await fireEvent.click(screen.getByRole("button", { name: "Create" }));
		expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Choose image" })).toBeDisabled();
		await fireEvent.submit(dialog().querySelector("form")!);
		pressEscapeIn(dialog());
		finish({ ok: true });
		await settle();

		expect(p.onSubmit).toHaveBeenCalledOnce();
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("Cancel and Escape close without creating and drop the chosen image", async () => {
		const p = props();
		render(CreateTeamDialog, { props: p });
		await pick(png);

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		pressEscapeIn(dialog());

		expect(p.onClose).toHaveBeenCalledTimes(2);
		expect(p.onSubmit).not.toHaveBeenCalled();
		expect(revoked).toEqual(["blob:preview"]);
	});

	it("starts empty when opened again", async () => {
		const p = props();
		const view = render(CreateTeamDialog, { props: p });
		await fireEvent.input(nameInput(), { target: { value: "Lions" } });
		await pick(png);

		await view.rerender({ ...p, open: false });
		await view.rerender({ ...p, open: true });

		expect(nameInput().value).toBe("");
		expect(within(dialog()).queryByRole("img")).toBeNull();
	});
});
