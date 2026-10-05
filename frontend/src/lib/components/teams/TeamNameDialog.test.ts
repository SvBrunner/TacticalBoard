import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import TeamNameDialog from "./TeamNameDialog.svelte";

type Outcome = { ok: true } | { ok: false; message: (m: unknown) => string };

function props(overrides: Record<string, unknown> = {}) {
	return {
		open: true,
		initialName: "Lions",
		onSubmit: vi.fn(async (): Promise<Outcome> => ({ ok: true })),
		onClose: vi.fn(),
		...overrides,
	};
}

const dialog = () => screen.getByRole("dialog", { name: "Rename team" }) as HTMLDialogElement;
const input = () => screen.getByRole("textbox", { name: "Team name" }) as HTMLInputElement;

async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

describe("TeamNameDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	it("opens with the current name, focused, limited to 64 characters", () => {
		render(TeamNameDialog, { props: props() });

		expect(within(dialog()).getByRole("heading", { level: 2, name: "Rename team" })).toBeInTheDocument();
		expect(input().value).toBe("Lions");
		expect(input()).toHaveFocus();
		expect(input()).toHaveAttribute("maxlength", "64");
		expect(screen.getByRole("button", { name: "Rename" })).toHaveAttribute("type", "submit");
	});

	it("renames with the trimmed name and closes", async () => {
		const p = props();
		render(TeamNameDialog, { props: p });

		await fireEvent.input(input(), { target: { value: " Tigers " } });
		await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
		await settle();

		expect(p.onSubmit).toHaveBeenCalledWith("Tigers");
		expect(p.onClose).toHaveBeenCalledOnce();
	});

	it("doesn't send an invalid name", async () => {
		const p = props();
		render(TeamNameDialog, { props: p });

		await fireEvent.input(input(), { target: { value: "a\u0007b" } });
		await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
		await settle();

		expect(p.onSubmit).not.toHaveBeenCalled();
		expect(screen.getByRole("alert")).toHaveTextContent("Don't use line breaks or other control characters.");
	});

	it("shows the server's message and stays open", async () => {
		const p = props({
			onSubmit: vi.fn(async (): Promise<Outcome> => ({
				ok: false,
				message: () => "Taken.",
			})),
		});
		render(TeamNameDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("Taken.");
		expect(p.onClose).not.toHaveBeenCalled();
	});

	it("ignores Cancel and Escape while renaming, closes with them otherwise", async () => {
		let finish: (outcome: Outcome) => void = () => undefined;
		const p = props({
			onSubmit: vi.fn(() => new Promise<Outcome>((resolve) => (finish = resolve))),
		});
		render(TeamNameDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Rename" }));
		pressEscapeIn(dialog());
		expect(p.onClose).not.toHaveBeenCalled();
		finish({ ok: false, message: () => "Taken." });
		await settle();

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		pressEscapeIn(dialog());
		expect(p.onClose).toHaveBeenCalledTimes(2);
	});
});
