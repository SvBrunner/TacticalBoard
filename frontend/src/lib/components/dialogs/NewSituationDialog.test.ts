import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { installDialogPolyfill, pressEscapeIn } from "$lib/testing/dialogPolyfill";
import NewSituationDialog from "./NewSituationDialog.svelte";
import { i18n } from "$lib/i18n";

function props(overrides: Record<string, unknown> = {}) {
	return { open: true, onCreate: vi.fn(), onCancel: vi.fn(), ...overrides };
}

const dialog = () => screen.getByRole("dialog", { name: "New situation" }) as HTMLDialogElement;
const titleInput = () => screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
const radio = (name: RegExp) => screen.getByRole("radio", { name }) as HTMLInputElement;

describe("NewSituationDialog", () => {
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	describe("semantics", () => {
		it("is a dialog named by its heading, containing a dialog form", () => {
			render(NewSituationDialog, { props: props() });

			expect(dialog().tagName).toBe("DIALOG");
			expect(within(dialog()).getByRole("heading", { level: 2, name: "New situation" })).toBeInTheDocument();
			expect(dialog().querySelector("form")).toHaveAttribute("method", "dialog");
		});

		it("has a labelled title field with the default title as placeholder", () => {
			render(NewSituationDialog, { props: props() });

			expect(titleInput()).toHaveAttribute("placeholder", "Untitled Situation");
			expect(titleInput().value).toBe("");
		});

		it("groups the field choice in a fieldset with the legend Field", () => {
			render(NewSituationDialog, { props: props() });

			const group = screen.getByRole("group", { name: "Field" });
			expect(group.tagName).toBe("FIELDSET");
			expect(within(group).getAllByRole("radio").map((r) => r.closest("label")?.textContent?.trim())).toEqual([
				"Full field",
				"Half field",
			]);
		});

		it("has no description field", () => {
			render(NewSituationDialog, { props: props() });

			expect(screen.getAllByRole("textbox")).toHaveLength(1);
			expect(screen.queryByLabelText(/description/i)).toBeNull();
		});

		it("has Create (submit) and Cancel buttons", () => {
			render(NewSituationDialog, { props: props() });

			expect(screen.getByRole("button", { name: "Create" })).toHaveAttribute("type", "submit");
			expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
		});
	});

	it("defaults to the full field", () => {
		render(NewSituationDialog, { props: props() });

		expect(radio(/full/i).checked).toBe(true);
		expect(radio(/half/i).checked).toBe(false);
	});

	it("opens as a modal with focus in the title field", () => {
		render(NewSituationDialog, { props: props() });

		expect(dialog().open).toBe(true);
		expect(titleInput()).toHaveFocus();
	});

	it("is not shown while closed", () => {
		const { container } = render(NewSituationDialog, { props: props({ open: false }) });

		expect(container.querySelector("dialog")?.open).toBe(false);
	});

	it("Create submits the title and the chosen field", async () => {
		const p = props();
		render(NewSituationDialog, { props: p });

		await fireEvent.input(titleInput(), { target: { value: "  Powerplay  " } });
		await fireEvent.click(radio(/half/i));
		await fireEvent.submit(dialog().querySelector("form")!);

		expect(p.onCreate).toHaveBeenCalledWith({ title: "Powerplay", fieldType: "half" });
		expect(p.onCancel).not.toHaveBeenCalled();
	});

	it("clicking Create submits the form", async () => {
		const p = props();
		render(NewSituationDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(p.onCreate).toHaveBeenCalledWith({ title: "Untitled Situation", fieldType: "full" });
	});

	it("submits a blank title as the default title of the UI language", async () => {
		const p = props();
		render(NewSituationDialog, { props: p });

		await fireEvent.input(titleInput(), { target: { value: "   " } });
		await fireEvent.submit(dialog().querySelector("form")!);

		expect(p.onCreate).toHaveBeenCalledWith({ title: "Untitled Situation", fieldType: "full" });
	});

	it("is German in German, with the German default title", async () => {
		i18n.select("de");
		const p = props();
		render(NewSituationDialog, { props: p });

		expect(screen.getByRole("heading", { name: "Neue Situation" })).toBeInTheDocument();
		expect(screen.getByLabelText("Titel")).toHaveAttribute("placeholder", "Unbenannte Situation");
		expect(screen.getByRole("radio", { name: "Ganzes Feld" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Halbes Feld" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Erstellen" }));

		expect(p.onCreate).toHaveBeenCalledWith({ title: "Unbenannte Situation", fieldType: "full" });
	});

	it("Cancel calls onCancel only", async () => {
		const p = props();
		render(NewSituationDialog, { props: p });

		await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(p.onCancel).toHaveBeenCalledOnce();
		expect(p.onCreate).not.toHaveBeenCalled();
	});

	it("Escape cancels", () => {
		const p = props();
		render(NewSituationDialog, { props: p });

		pressEscapeIn(dialog());

		expect(p.onCancel).toHaveBeenCalledOnce();
		expect(p.onCreate).not.toHaveBeenCalled();
	});

	it("resets to the defaults when opened again", async () => {
		const { rerender } = render(NewSituationDialog, { props: props() });
		await fireEvent.input(titleInput(), { target: { value: "Old" } });
		await fireEvent.click(radio(/half/i));

		await rerender(props({ open: false }));
		await rerender(props({ open: true }));

		expect(titleInput().value).toBe("");
		expect(radio(/full/i).checked).toBe(true);
		expect(titleInput()).toHaveFocus();
	});

	it("returns focus to the opener when closed", async () => {
		const opener = document.createElement("button");
		document.body.appendChild(opener);
		opener.focus();
		const { rerender } = render(NewSituationDialog, { props: props({ open: false }) });

		await rerender(props({ open: true }));
		await rerender(props({ open: false }));

		expect(opener).toHaveFocus();
		opener.remove();
	});
});
