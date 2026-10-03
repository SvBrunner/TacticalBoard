import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { get } from "svelte/store";
import Konva from "konva";
import { notifications } from "$lib/debug/Notifications";
import { situationEditor } from "$lib/editor/SituationEditor";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";
import type { Shape } from "konva/lib/Shape";
import type { PointElement } from "$lib/model/elements/PointElement";
import EditorPage from "./+page.svelte";

/** Lets pending promise continuations and the resulting DOM updates run. */
async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

const messages = () => get(notifications.notifications).map((n) => n.message);

describe("editor page", () => {
	let restoreDialog: () => void;
	let restoreCanvas: () => void;

	beforeEach(() => {
		restoreDialog = installDialogPolyfill();
		restoreCanvas = installFakeCanvasContext();
		FakeResizeObserver.reset();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
		notifications.clear();
		situationEditor.createNew({ title: "Breakout", fieldType: "full" });
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		restoreCanvas();
		restoreDialog();
	});

	it("shows the situation title, the tools and the field", () => {
		render(EditorPage);

		expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1, name: "Breakout" })).toBeInTheDocument();
		expect(screen.getByRole("complementary", { name: "Tools" })).toBeInTheDocument();
		expect(within(screen.getByRole("main")).getByRole("region", { name: "Field" })).toBeInTheDocument();
	});

	it("shows a half-field situation rotated to portrait", async () => {
		situationEditor.createNew({ title: "Half", fieldType: "half" });
		render(EditorPage);

		FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500);
		await tick();

		const stage = Konva.stages[Konva.stages.length - 1];
		expect(stage.rotation()).toBe(90);
		expect(stage.width()).toBe(500);
	});

	describe("New", () => {
		it("opens the New situation dialog right away when nothing is unsaved", async () => {
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			expect(screen.getByRole("dialog", { name: "New situation" })).toHaveAttribute("open");
		});

		it("asks 'Discard changes?' first when there are unsaved changes", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			expect(screen.getByRole("alertdialog", { name: "Discard changes?" })).toHaveAttribute("open");
			expect(document.querySelector<HTMLDialogElement>("dialog:not([role])")?.open).toBe(false);
		});

		it("discarding and creating replaces the situation", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);
			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
			await settle();
			await fireEvent.click(screen.getByRole("radio", { name: /half/i }));
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));
			await tick();

			expect(situationEditor.current()).toMatchObject({ title: "Untitled Situation", fieldType: "half" });
			expect(get(situationEditor.elements)).toEqual([]);
			expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Untitled Situation");
		});

		it("keyboard shortcuts don't reach the board while a modal dialog has focus", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);
			await fireEvent.click(screen.getByRole("button", { name: "New" }));
			await settle();

			await fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "z", ctrlKey: true });

			expect(get(situationEditor.elements)).toHaveLength(1);
		});
	});

	describe("undo/redo", () => {
		it("undoes via the keyboard outside dialogs and logs it", async () => {
			situationEditor.addElement(1, 1, "red", "Player");
			render(EditorPage);

			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });

			expect(get(situationEditor.elements)).toEqual([]);
			expect(messages()).toContain("Undo: Add Player");
		});

		it("logs nothing when there is nothing to undo or redo", async () => {
			render(EditorPage);

			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
			await fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true });

			expect(messages().filter((m) => /undo|redo/i.test(m))).toEqual([]);
		});
	});

	describe("element popover", () => {
		async function openPopoverFor(id: string) {
			render(EditorPage);
			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 1000, 500);
			await tick();
			const stage = Konva.stages[Konva.stages.length - 1];
			const shape = stage.findOne(`#${id}`)!;
			shape.fire("pointerclick", { evt: { button: 0, shiftKey: false, pointerType: "touch", preventDefault: () => {} } }, true);
			await tick();
			return screen.getByRole("dialog", { name: "Edit marker" });
		}

		const labelOf = (id: string) => (get(situationEditor.elements).find((e) => e.id === id) as PointElement).label;
		const selectedStroke = (id: string) => (Konva.stages.at(-1)!.findOne(`#${id}`) as Shape).strokeWidth();

		it("Close closes the popover and clears the selection", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);
			expect(selectedStroke(id)).toBeGreaterThan(0);

			await fireEvent.click(screen.getByRole("button", { name: "Close" }));

			expect(screen.queryByRole("dialog", { name: "Edit marker" })).not.toBeInTheDocument();
			expect(selectedStroke(id)).toBe(0);
		});

		it("stays open when the tool changes", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);

			await fireEvent.click(within(screen.getByRole("complementary", { name: "Tools" })).getByRole("button", { name: "Ball" }));

			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBeInTheDocument();
		});

		it("stays open on a resize and moves with the element", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			const dialog = await openPopoverFor(id);
			const before = dialog.style.getPropertyValue("--anchor-x");

			FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), 400, 600);
			await tick();

			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBe(dialog);
			expect(dialog.style.getPropertyValue("--anchor-x")).not.toBe(before);
		});

		it("sets a position label on the player and draws it", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);

			await fireEvent.click(screen.getByRole("radio", { name: /^C\b/ }));
			await tick();

			expect(labelOf(id)).toBe("C");
			expect((Konva.stages.at(-1)!.findOne(".ElementLabel") as Konva.Text).text()).toBe("C");
		});

		it("a typed label is one undo step", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);
			const input = screen.getByRole("textbox", { name: "Custom" });

			input.focus();
			await fireEvent.input(input, { target: { value: "1" } });
			await fireEvent.input(input, { target: { value: "10" } });
			await fireEvent.blur(input);
			expect(labelOf(id)).toBe("10");

			situationEditor.undo();
			expect(labelOf(id)).toBe("");
			expect(get(situationEditor.elements)).toHaveLength(1);
		});

		it.each([["Delete"], ["Backspace"]])("%s inside the label field does not delete the element", async (key) => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);
			const input = screen.getByRole("textbox", { name: "Custom" });

			input.focus();
			await fireEvent.keyDown(input, { key });

			expect(get(situationEditor.elements).map((e) => e.id)).toEqual([id]);
			expect(screen.getByRole("dialog", { name: "Edit marker" })).toBeInTheDocument();
		});

		it("Delete outside text fields still deletes the selected element", async () => {
			const id = situationEditor.addElement(500, 250, "red", "Player");
			await openPopoverFor(id);

			await fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), { key: "Delete" });

			expect(get(situationEditor.elements)).toEqual([]);
		});
	});

	it("Export downloads the situation and clears the unsaved-changes flag", async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		situationEditor.addElement(1, 1, "red", "Player");
		render(EditorPage);

		await fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

		expect(click).toHaveBeenCalledOnce();
		expect(situationEditor.isDirty()).toBe(false);
		click.mockRestore();
	});
});
