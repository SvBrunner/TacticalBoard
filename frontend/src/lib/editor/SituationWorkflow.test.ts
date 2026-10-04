import { de, en, inEnglishDeep, translateDeep } from "$lib/testing/i18n";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FixedClock } from "$lib/model/Clock";
import { Frame } from "$lib/model/Frame";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { InvalidJsonError } from "$lib/model/serialization/SituationImportErrors";
import { SituationEditor } from "./SituationEditor";
import { SituationLink } from "$lib/storage/SituationLink";
import { inFolder, TOP_LEVEL } from "$lib/storage/SaveTarget";
import type { SituationSummary } from "$lib/storage/SituationApi";
import {
	DISCARD_CHANGES_REQUEST,
	DISCARD_SAVED_CHANGES_REQUEST,
	SituationWorkflow,
	type SituationFiles,
} from "./SituationWorkflow";

const savedSummary: SituationSummary = {
	id: "server-1",
	title: "Saved",
	sport: "floorball",
	fieldType: "full",
	folderId: null,
	revision: 1,
	createdAt: "2026-10-04T08:00:00Z",
	createdBy: { id: "u1", displayName: "Alice" },
	updatedAt: "2026-10-04T08:00:00Z",
	updatedBy: { id: "u1", displayName: "Alice" },
};

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
	let link: SituationLink;
	const file = new File(["{}"], "play.situation.json");

	beforeEach(() => {
		editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock());
		files = new FakeFiles();
		confirm = vi.fn(async () => true);
		log = { notify: vi.fn<(message: string, level?: string) => void>() };
		link = new SituationLink();
		workflow = new SituationWorkflow({ editor, files, link, confirm, log });
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

		it("for a server situation the question speaks of saving", async () => {
			link.attach(savedSummary);
			editor.addElement(0, 0, "red", "Player");

			await workflow.confirmDiscardIfDirty();

			expect(confirm).toHaveBeenCalledWith(DISCARD_SAVED_CHANGES_REQUEST);
			expect(inEnglishDeep(DISCARD_SAVED_CHANGES_REQUEST)).toMatchObject({ title: "Discard changes?", confirmLabel: "Discard" });
			expect(DISCARD_SAVED_CHANGES_REQUEST.message(en)).toContain("haven't been saved");
		});

		it("when logged in, the question for a never-saved situation speaks of saving too (export doesn't count)", async () => {
			const loggedIn = new SituationWorkflow({ editor, files, link, confirm, isLoggedIn: () => true });
			editor.addElement(0, 0, "red", "Player");

			await loggedIn.confirmDiscardIfDirty();

			expect(confirm).toHaveBeenCalledWith(DISCARD_SAVED_CHANGES_REQUEST);
		});

		it("the question is 'Discard changes?' with Discard/Cancel", () => {
			expect(inEnglishDeep(DISCARD_CHANGES_REQUEST)).toMatchObject({
				title: "Discard changes?",
				message: "The current situation has changes that haven't been exported. They will be lost.",
				confirmLabel: "Discard",
				cancelLabel: "Cancel",
			});
			expect(translateDeep(DISCARD_CHANGES_REQUEST, de)).toMatchObject({
				title: "Änderungen verwerfen?",
				confirmLabel: "Verwerfen",
				cancelLabel: "Abbrechen",
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

		it("starts an unsaved new situation, also after a server situation", () => {
			link.attach(savedSummary);

			workflow.createNew({ title: "Box play", fieldType: "half" });

			expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: TOP_LEVEL });
		});

		it("remembers the folder it was started in, for its first save", () => {
			workflow.createNew({ title: "Box play", fieldType: "half" }, inFolder("f1"));

			expect(link.current()).toEqual({ kind: "unsaved", origin: "new", target: { folderId: "f1" } });
		});
	});

	describe("importFile", () => {
		it("opens the imported situation when nothing is unsaved", async () => {
			await expect(workflow.importFile(file)).resolves.toBe(true);

			expect(editor.current().id).toBe("imported");
			expect(confirm).not.toHaveBeenCalled();
			expect(messages()).toEqual(["Loading play.situation.json…", 'Loaded "Imported" from play.situation.json']);
		});

		it("marks the situation as imported (for its first save)", async () => {
			link.attach(savedSummary);

			await workflow.importFile(file);

			expect(link.current()).toEqual({ kind: "unsaved", origin: "imported", target: TOP_LEVEL });
		});

		it("remembers the folder an import was started in, for its first save", async () => {
			await workflow.importFile(file, inFolder("f1"));

			expect(link.current()).toEqual({ kind: "unsaved", origin: "imported", target: { folderId: "f1" } });
		});

		it("keeps the link when the import is cancelled", async () => {
			link.attach(savedSummary);
			editor.addElement(0, 0, "red", "Player");
			confirm.mockResolvedValue(false);

			await workflow.importFile(file);

			expect(link.saved()).toBe(savedSummary);
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

		it("doesn't mark a server situation saved: only saving on the server does", () => {
			link.attach(savedSummary);
			editor.addElement(0, 0, "red", "Player");

			workflow.exportCurrent();

			expect(files.exported).toHaveLength(1);
			expect(editor.isDirty()).toBe(true);
		});

		it("when logged in, doesn't mark a new, never-saved situation saved either", () => {
			const loggedIn = new SituationWorkflow({ editor, files, link, confirm, isLoggedIn: () => true });
			editor.createNew({ title: "Breakout", fieldType: "full" });
			link.startNew();
			editor.addElement(0, 0, "red", "Player");

			loggedIn.exportCurrent();

			expect(files.exported).toHaveLength(1);
			expect(editor.isDirty()).toBe(true);
		});

		it("in local mode (not logged in) an export still counts as saved", () => {
			const localMode = new SituationWorkflow({ editor, files, link, confirm, isLoggedIn: () => false });
			editor.addElement(0, 0, "red", "Player");

			localMode.exportCurrent();

			expect(editor.isDirty()).toBe(false);
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
		const silent = new SituationWorkflow({ editor, files, link, confirm });

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

		it("forgets the server situation", async () => {
			link.attach(savedSummary);

			await workflow.leave(vi.fn());

			expect(link.saved()).toBeNull();
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
