import { describe, it, expect, beforeEach, vi } from "vitest";
import { FixedClock } from "$lib/model/Clock";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { InvalidJsonError } from "$lib/model/serialization/SituationImportErrors";
import { SituationEditor } from "./SituationEditor";
import { DISCARD_CHANGES_REQUEST, SituationWorkflow, type SituationFiles } from "./SituationWorkflow";

function importedSituation(): Situation {
	return new Situation({
		id: "imported",
		title: "Imported",
		description: "",
		sport: "floorball",
		fieldType: "half",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: [new Frame("f1", "", [])],
	});
}

class FakeFiles implements SituationFiles {
	readonly exported: Situation[] = [];
	importResult: Situation | Error = importedSituation();

	export(situation: Situation): string {
		this.exported.push(situation);
		return "file.situation.json";
	}

	async import(): Promise<Situation> {
		if (this.importResult instanceof Error) {
			throw this.importResult;
		}
		return this.importResult;
	}
}

describe("SituationWorkflow", () => {
	let editor: SituationEditor;
	let files: FakeFiles;
	let confirm: ReturnType<typeof vi.fn<(request: unknown) => Promise<boolean>>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let workflow: SituationWorkflow;
	const file = new File(["{}"], "play.situation.json");

	beforeEach(() => {
		editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock());
		files = new FakeFiles();
		confirm = vi.fn(async () => true);
		log = { notify: vi.fn<(message: string, level?: string) => void>() };
		workflow = new SituationWorkflow({ editor, files, confirm, log });
	});

	const messages = () => log.notify.mock.calls.map((call) => call[0]);

	describe("confirmDiscardIfDirty", () => {
		it("doesn't ask and allows when there are no unsaved changes", async () => {
			await expect(workflow.confirmDiscardIfDirty()).resolves.toBe(true);
			expect(confirm).not.toHaveBeenCalled();
		});

		it.each([[true], [false]])("asks 'Discard changes?' when dirty and returns the answer %s", async (answer) => {
			editor.addElement(0, 0, "red", "Player");
			confirm.mockResolvedValue(answer);

			await expect(workflow.confirmDiscardIfDirty()).resolves.toBe(answer);
			expect(confirm).toHaveBeenCalledWith(DISCARD_CHANGES_REQUEST);
		});

		it("the question is 'Discard changes?' with Discard/Cancel", () => {
			expect(DISCARD_CHANGES_REQUEST).toMatchObject({
				title: "Discard changes?",
				confirmLabel: "Discard",
				cancelLabel: "Cancel",
			});
		});
	});

	describe("createNew", () => {
		it("creates the situation in the editor and logs it", () => {
			const created = workflow.createNew({ title: "Box play", fieldType: "half" });

			expect(editor.current()).toBe(created);
			expect(created).toMatchObject({ title: "Box play", fieldType: "half" });
			expect(messages()).toEqual(['Created "Box play" (half field)']);
		});
	});

	describe("importFile", () => {
		it("opens the imported situation when nothing is unsaved", async () => {
			await expect(workflow.importFile(file)).resolves.toBe(true);

			expect(editor.current().id).toBe("imported");
			expect(confirm).not.toHaveBeenCalled();
			expect(messages()).toEqual(["Loading play.situation.json…", 'Loaded "Imported" from play.situation.json']);
		});

		it("asks before discarding unsaved changes and opens the file when confirmed", async () => {
			editor.addElement(0, 0, "red", "Player");

			await expect(workflow.importFile(file)).resolves.toBe(true);

			expect(confirm).toHaveBeenCalledOnce();
			expect(editor.current().id).toBe("imported");
			expect(editor.isDirty()).toBe(false);
		});

		it("keeps the current situation when the user cancels", async () => {
			editor.addElement(0, 0, "red", "Player");
			const before = editor.current();
			confirm.mockResolvedValue(false);

			await expect(workflow.importFile(file)).resolves.toBe(false);

			expect(editor.current()).toBe(before);
			expect(editor.isDirty()).toBe(true);
			expect(messages()).toContain("Import of play.situation.json cancelled");
		});

		it("reports an invalid file as an error without asking or changing anything", async () => {
			editor.addElement(0, 0, "red", "Player");
			const before = editor.current();
			files.importResult = new InvalidJsonError("Unexpected token");

			await expect(workflow.importFile(file)).resolves.toBe(false);

			expect(confirm).not.toHaveBeenCalled();
			expect(editor.current()).toBe(before);
			expect(log.notify).toHaveBeenLastCalledWith(
				expect.stringMatching(/^Failed to load play\.situation\.json: /),
				"error",
			);
		});
	});

	describe("exportCurrent", () => {
		it("exports the current situation and marks it saved", () => {
			editor.addElement(0, 0, "red", "Player");

			expect(workflow.exportCurrent()).toBe("file.situation.json");

			expect(files.exported).toEqual([editor.current()]);
			expect(editor.isDirty()).toBe(false);
			expect(messages()).toEqual(["Exported 1 frame(s) to file.situation.json"]);
		});
	});

	describe("undo/redo", () => {
		it("logs the undone and redone step", () => {
			editor.addElement(0, 0, "red", "Player");

			workflow.undo();
			workflow.redo();

			expect(messages()).toEqual(["Undo: Add Player", "Redo: Add Player"]);
			expect(editor.current().frames[0].elements).toHaveLength(1);
		});

		it("stays silent when there is nothing to undo or redo", () => {
			workflow.undo();
			workflow.redo();

			expect(log.notify).not.toHaveBeenCalled();
		});
	});

	it("works without a log", async () => {
		const silent = new SituationWorkflow({ editor, files, confirm });

		silent.createNew({ title: "", fieldType: "full" });
		await expect(silent.importFile(file)).resolves.toBe(true);
		silent.exportCurrent();
		silent.undo();
	});

	describe("leave (back to the start page)", () => {
		beforeEach(() => {
			editor.createNew({ title: "Breakout", fieldType: "full" });
		});

		it("without unsaved changes navigates without asking and closes the situation", async () => {
			const navigate = vi.fn();

			await expect(workflow.leave(navigate)).resolves.toBe(true);

			expect(confirm).not.toHaveBeenCalled();
			expect(navigate).toHaveBeenCalledOnce();
			expect(editor.isSituationOpen()).toBe(false);
			expect(messages()).toContain('Closed "Breakout"');
		});

		it("with unsaved changes asks 'Discard changes?' first; confirming navigates and discards them", async () => {
			editor.addElement(0, 0, "red", "Player");
			const navigate = vi.fn();

			await expect(workflow.leave(navigate)).resolves.toBe(true);

			expect(confirm).toHaveBeenCalledWith(DISCARD_CHANGES_REQUEST);
			expect(navigate).toHaveBeenCalledOnce();
			expect(editor.isDirty()).toBe(false);
			expect(editor.isSituationOpen()).toBe(false);
		});

		it("cancelling keeps the editor and the unsaved changes", async () => {
			editor.addElement(0, 0, "red", "Player");
			confirm.mockResolvedValue(false);
			const navigate = vi.fn();

			await expect(workflow.leave(navigate)).resolves.toBe(false);

			expect(navigate).not.toHaveBeenCalled();
			expect(editor.isDirty()).toBe(true);
			expect(editor.isSituationOpen()).toBe(true);
			expect(messages()).toContain("Leaving the editor cancelled");
		});

		it("closes the situation only after the navigation finished", async () => {
			let openDuringNavigation: boolean | undefined;
			const navigate = vi.fn(async () => {
				openDuringNavigation = editor.isSituationOpen();
			});

			await workflow.leave(navigate);

			expect(openDuringNavigation).toBe(true);
			expect(editor.isSituationOpen()).toBe(false);
		});
	});
});
