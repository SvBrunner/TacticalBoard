import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { SituationEditor } from "$lib/editor/SituationEditor";
import { FixedClock } from "$lib/model/Clock";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { SituationSerializer } from "$lib/model/serialization/SituationSerializer";
import { storedFrom, summaryOf } from "$lib/testing/storageFakes";
import { SituationApi, type SituationOrigin, type StoredSituation } from "./SituationApi";
import { SituationLink } from "./SituationLink";
import { FolderApi } from "./FolderApi";
import { inFolder, TOP_LEVEL, type SaveTarget } from "./SaveTarget";
import { SituationSaver, type ConflictChoice, type SaveApi } from "./SituationSaver";

class FakeApi implements SaveApi {
	readonly creates: { document: unknown; origin: SituationOrigin; target: SaveTarget }[] = [];
	readonly updates: { id: string; revision: number; document: unknown }[] = [];
	/** Answers (or errors) of the next calls, in order; otherwise the server echoes the document. */
	readonly script: (StoredSituation | Error)[] = [];
	private revision = 1;

	constructor(private readonly editor: SituationEditor) {}

	async create(document: unknown, origin: SituationOrigin, target: SaveTarget): Promise<StoredSituation> {
		this.creates.push({ document, origin, target });
		return this.answer(origin === "copy" ? "server-copy" : "server-1", 1, target.folderId);
	}

	async update(id: string, revision: number, document: unknown): Promise<StoredSituation> {
		this.updates.push({ id, revision, document });
		return this.answer(id, revision + 1);
	}

	private answer(id: string, revision: number, folderId: string | null = null): StoredSituation {
		const next = this.script.shift();
		if (next instanceof Error) {
			throw next;
		}
		this.revision = revision;
		return next ?? storedFrom(this.editor.current(), { id, revision: this.revision, folderId, updatedAt: "2026-10-04T09:00:00.000Z" });
	}
}

const conflict = (currentRevision: unknown = 5) =>
	new ApiError(412, { type: SituationApi.SAVE_CONFLICT, currentRevision });

describe("SituationSaver", () => {
	let editor: SituationEditor;
	let link: SituationLink;
	let api: FakeApi;
	let choice: ReturnType<typeof vi.fn<() => Promise<ConflictChoice>>>;
	let onSaved: ReturnType<typeof vi.fn<(saved: StoredSituation) => void>>;
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let saver: SituationSaver;

	beforeEach(() => {
		editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock("2026-10-04T08:30:00.000Z"));
		editor.createNew({ title: "Powerplay", fieldType: "full" });
		editor.addElement(1, 1, "red", "Player");
		link = new SituationLink();
		api = new FakeApi(editor);
		choice = vi.fn(async () => "cancel" as ConflictChoice);
		onSaved = vi.fn();
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		saver = new SituationSaver({
			editor,
			link,
			api,
			serializer: new SituationSerializer(),
			chooseOnConflict: choice,
			onSaved,
			onSessionEnded,
			log,
		});
	});

	describe("the first save", () => {
		it("creates the situation as new and shows the server's state", async () => {
			await expect(saver.save()).resolves.toBe(true);

			expect(api.creates).toHaveLength(1);
			expect(api.creates[0].origin).toBe("new");
			expect(api.creates[0].target).toEqual(TOP_LEVEL);
			expect(api.creates[0].document).toMatchObject({ formatVersion: 3, situation: { title: "Powerplay" } });
			expect(editor.current()).toMatchObject({ id: "server-1", createdAt: "2026-10-04T08:00:00.000Z" });
			expect(editor.isDirty()).toBe(false);
			expect(link.saved()).toMatchObject({ id: "server-1", revision: 1 });
			expect(link.saved()).not.toHaveProperty("document");
			expect(saver.current()).toEqual({ status: "saved", title: "Powerplay" });
			expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: "server-1" }));
		});

		it("creates an imported situation as imported (the server numbers a taken title)", async () => {
			link.startImported();
			api.script.push(storedFrom(editor.current(), { title: "Powerplay (2)" }));

			await saver.save();

			expect(api.creates[0].origin).toBe("imported");
			expect(editor.current().title).toBe("Powerplay (2)");
		});

		it("creates the situation where it was started: a folder", async () => {
			link.startNew(inFolder("f1"));

			await saver.save();

			expect(api.creates[0]).toMatchObject({ origin: "new", target: { folderId: "f1" } });
			expect(link.saved()?.folderId).toBe("f1");
		});

		it("creates an import in the folder it was started in", async () => {
			link.startImported(inFolder("f2"));

			await saver.save();

			expect(api.creates[0]).toMatchObject({ origin: "imported", target: { folderId: "f2" } });
		});
	});

	describe("later saves", () => {
		beforeEach(async () => {
			await saver.save();
			editor.addElement(2, 2, "red", "Player");
		});

		it("update on top of the known revision", async () => {
			await expect(saver.save()).resolves.toBe(true);

			expect(api.updates).toEqual([expect.objectContaining({ id: "server-1", revision: 1 })]);
			expect(link.saved()?.revision).toBe(2);
			expect(editor.isDirty()).toBe(false);
		});

		it("on a conflict, Overwrite saves again on top of the newest revision", async () => {
			api.script.push(conflict(5));
			choice.mockResolvedValue("overwrite");

			await expect(saver.save()).resolves.toBe(true);

			expect(choice).toHaveBeenCalledOnce();
			expect(api.updates.map((update) => update.revision)).toEqual([1, 5]);
			expect(link.saved()?.revision).toBe(6);
		});

		it("asks again when the overwrite conflicts too", async () => {
			api.script.push(conflict(5), conflict(6));
			choice.mockResolvedValue("overwrite");

			await saver.save();

			expect(choice).toHaveBeenCalledTimes(2);
			expect(api.updates.map((update) => update.revision)).toEqual([1, 5, 6]);
		});

		it("keeps the known revision when the conflict doesn't name the newest one", async () => {
			api.script.push(conflict("nonsense"));
			choice.mockResolvedValueOnce("overwrite").mockResolvedValueOnce("cancel");
			api.script.push(conflict(undefined));

			await saver.save();

			expect(api.updates.map((update) => update.revision)).toEqual([1, 1]);
		});

		it("on a conflict, Save as copy creates a new situation and the editor continues with the copy", async () => {
			api.script.push(conflict());
			choice.mockResolvedValue("copy");

			await expect(saver.save()).resolves.toBe(true);

			expect(api.creates.map((create) => create.origin)).toEqual(["new", "copy"]);
			expect(api.creates[1].target).toEqual(TOP_LEVEL);
			expect(editor.current().id).toBe("server-copy");
			expect(link.saved()?.id).toBe("server-copy");
			expect(editor.isDirty()).toBe(false);
		});

		it("on a conflict, Save as copy creates the copy in the original's folder", async () => {
			link.attach({ ...link.saved()!, folderId: "f1" });
			api.script.push(conflict());
			choice.mockResolvedValue("copy");

			await saver.save();

			expect(api.creates[1]).toMatchObject({ origin: "copy", target: { folderId: "f1" } });
		});

		it("on a conflict, Cancel keeps everything as it is", async () => {
			api.script.push(conflict());

			await expect(saver.save()).resolves.toBe(false);

			expect(editor.isDirty()).toBe(true);
			expect(link.saved()?.revision).toBe(1);
			expect(saver.current()).toEqual({ status: "idle" });
		});
	});

	describe("failures", () => {
		it.each<[string, Error, RegExp]>([
			["a taken title", new ApiError(409, { type: SituationApi.DUPLICATE_TITLE }), /^A situation titled "Powerplay" already exists\. Choose another title/],
			["a deleted situation", new ApiError(404, { type: SituationApi.NOT_FOUND }), /no longer exists on the server/],
			["a deleted folder", new ApiError(404, { type: FolderApi.NOT_FOUND }), /^The folder to save in no longer exists \(it was deleted\)\. Export the situation to keep it\.$/],
			["no server", new ApiUnavailableError(), /not reachable/],
			["a validation problem", new ApiError(400, { errors: { "document.situation.title": ["expected at most 200 characters"] } }), /document\.situation\.title: expected at most 200 characters/],
			["another problem", new ApiError(500, { detail: "Boom." }), /couldn't be saved: Boom\./],
			["something unexpected", new TypeError("x"), /^The situation couldn't be saved\.$/],
		])("shows %s as a message and keeps the situation unsaved", async (_name, error, message) => {
			api.script.push(error as never);

			await expect(saver.save()).resolves.toBe(false);

			const state = saver.current();
			expect(state.status).toBe("failed");
			expect(state.status === "failed" && state.message).toMatch(message);
			expect(editor.isDirty()).toBe(true);
			expect(link.saved()).toBeNull();
			expect(log.notify).toHaveBeenLastCalledWith(expect.stringMatching(/^Save failed: /), "error");
		});

		it("an ended session refreshes the login state", async () => {
			api.script.push(new ApiError(401, {}) as never);

			await saver.save();

			expect(onSessionEnded).toHaveBeenCalledOnce();
			expect(saver.current()).toMatchObject({ status: "failed", message: expect.stringMatching(/session has ended/) });
		});

		it("a blank title is reported as the default title", async () => {
			editor.changeTitle("  ");
			api.script.push(new ApiError(409, { type: SituationApi.DUPLICATE_TITLE }) as never);

			await saver.save();

			expect(saver.current()).toMatchObject({ message: expect.stringContaining('"Untitled Situation"') });
		});

		it("dismissing forgets the message", async () => {
			api.script.push(new ApiUnavailableError() as never);
			await saver.save();

			saver.dismiss();

			expect(saver.current()).toEqual({ status: "idle" });
		});
	});

	it("ignores a second save while one is running", async () => {
		const first = saver.save();

		expect(saver.isSaving()).toBe(true);
		const second = saver.save();
		saver.dismiss();
		expect(saver.isSaving()).toBe(true);
		await expect(second).resolves.toBe(false);
		await expect(first).resolves.toBe(true);
		expect(api.creates).toHaveLength(1);
	});

	it("keeps edits made during the save unsaved", async () => {
		const pending = saver.save();
		editor.addElement(3, 3, "red", "Player");

		await pending;

		expect(editor.current().id).toBe("server-1");
		expect(editor.isDirty()).toBe(true);
	});

	it("works without the optional callbacks", async () => {
		const plain = new SituationSaver({
			editor,
			link,
			api,
			serializer: new SituationSerializer(),
			chooseOnConflict: choice,
		});

		await expect(plain.save()).resolves.toBe(true);
		api.script.push(new ApiError(401, {}) as never);
		await expect(plain.save()).resolves.toBe(false);
	});

	it("summaryOf is the server's metadata without the document", () => {
		expect(summaryOf()).not.toHaveProperty("document");
	});
});
