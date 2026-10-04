import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
import { SituationEditor } from "$lib/editor/SituationEditor";
import { SituationWorkflow, type SituationFiles } from "$lib/editor/SituationWorkflow";
import { FixedClock } from "$lib/model/Clock";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { SituationLink } from "$lib/storage/SituationLink";
import { inFolder, TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import SituationDialogs from "./SituationDialogs.svelte";

const imported = new Situation({
	id: "imported",
	title: "Imported",
	description: "",
	sport: "floorball",
	fieldType: "full",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	frames: [new Frame("f1", "", [])],
});

const files: SituationFiles = { export: () => "x.json", import: async () => imported };

/** Lets pending promise continuations and the resulting DOM updates run. */
async function settle() {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
	await tick();
}

describe("SituationDialogs", () => {
	let restore: () => void;
	let editor: SituationEditor;
	let prompt: ConfirmationPrompt;
	let workflow: SituationWorkflow;
	let onOpened: ReturnType<typeof vi.fn<() => void>>;
	let link: SituationLink;

	beforeEach(() => {
		restore = installDialogPolyfill();
		editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock());
		prompt = new ConfirmationPrompt();
		link = new SituationLink();
		workflow = new SituationWorkflow({ editor, files, link, confirm: (request) => prompt.request(request) });
		onOpened = vi.fn<() => void>();
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	function renderDialogs(target?: SaveTarget) {
		return render(SituationDialogs, { props: { workflow, prompt, onOpened, target } });
	}

	// Closed dialogs are hidden from the accessibility tree, so look them up structurally.
	const newDialog = () => document.querySelector<HTMLDialogElement>("dialog:not([role])")!;
	const confirmDialog = () => document.querySelector<HTMLDialogElement>("dialog[role=alertdialog]")!;

	it("shows no dialog initially", () => {
		renderDialogs();

		expect(newDialog().open).toBe(false);
		expect(confirmDialog().open).toBe(false);
	});

	describe("startNew", () => {
		it("opens the form directly when nothing is unsaved", async () => {
			const { component } = renderDialogs();

			await component.startNew();
			await settle();

			expect(confirmDialog().open).toBe(false);
			expect(newDialog().open).toBe(true);
		});

		it("creating closes the form, creates the situation and reports it opened", async () => {
			const { component } = renderDialogs();
			await component.startNew();
			await settle();

			await fireEvent.input(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Box" } });
			await fireEvent.click(screen.getByRole("radio", { name: /half/i }));
			await fireEvent.click(screen.getByRole("button", { name: "Create" }));

			expect(newDialog().open).toBe(false);
			expect(editor.current()).toMatchObject({ title: "Box", fieldType: "half" });
			expect(onOpened).toHaveBeenCalledOnce();
			expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
		});

		it("starts the situation at the given place (its first save goes there)", async () => {
			const { component } = renderDialogs(inFolder("f1"));
			await component.startNew();
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Create" }));

			expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: { folderId: "f1" } });
		});

		it("cancelling the form changes nothing", async () => {
			const before = editor.current();
			const { component } = renderDialogs();
			await component.startNew();
			await settle();

			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

			expect(newDialog().open).toBe(false);
			expect(editor.current()).toBe(before);
			expect(onOpened).not.toHaveBeenCalled();
		});

		it("asks 'Discard changes?' first when there are unsaved changes; Discard continues to the form", async () => {
			editor.addElement(0, 0, "red", "Player");
			const { component } = renderDialogs();

			const started = component.startNew();
			await settle();
			expect(confirmDialog().open).toBe(true);
			expect(confirmDialog()).toHaveAccessibleName("Discard changes?");
			expect(newDialog().open).toBe(false);

			await fireEvent.click(screen.getByRole("button", { name: "Discard" }));
			await started;
			await settle();

			expect(confirmDialog().open).toBe(false);
			expect(newDialog().open).toBe(true);
		});

		it("cancelling 'Discard changes?' aborts", async () => {
			editor.addElement(0, 0, "red", "Player");
			const before = editor.current();
			const { component } = renderDialogs();

			const started = component.startNew();
			await settle();
			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			await started;
			await settle();

			expect(confirmDialog().open).toBe(false);
			expect(newDialog().open).toBe(false);
			expect(editor.current()).toBe(before);
		});
	});

	describe("importFile", () => {
		const file = new File(["{}"], "x.situation.json");

		it("imports and reports it opened", async () => {
			const { component } = renderDialogs();

			await component.importFile(file);

			expect(editor.current().id).toBe("imported");
			expect(onOpened).toHaveBeenCalledOnce();
			expect(link.current()).toEqual({ kind: "unsaved", origin: "imported", target: TOP_LEVEL });
		});

		it("imports at the given place (its first save goes there)", async () => {
			const { component } = renderDialogs(inFolder("f1"));

			await component.importFile(file);

			expect(link.current()).toEqual({ kind: "unsaved", origin: "imported", target: { folderId: "f1" } });
		});

		it("does not report anything opened when the user keeps the unsaved changes", async () => {
			editor.addElement(0, 0, "red", "Player");
			const { component } = renderDialogs();

			const importing = component.importFile(file);
			await settle();
			expect(confirmDialog().open).toBe(true);
			await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
			await importing;

			expect(editor.current().id).not.toBe("imported");
			expect(onOpened).not.toHaveBeenCalled();
		});
	});
});
