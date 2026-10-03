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
