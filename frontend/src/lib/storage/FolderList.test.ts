import { inEnglishDeep } from "$lib/testing/i18n";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { FolderApi, type Folder } from "./FolderApi";
import { FolderList } from "./FolderList";

function folderOf(id: string, name: string): Folder {
	return { id, name, createdAt: "2026-10-04T08:00:00Z", updatedAt: "2026-10-04T08:00:00Z" };
}

describe("FolderList", () => {
	let folders: Folder[];
	let listError: Error | null;
	let createError: Error | null;
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let list: FolderList;

	beforeEach(() => {
		folders = [folderOf("f1", "Breakouts")];
		listError = null;
		createError = null;
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		list = new FolderList({
			api: {
				listPersonal: async () => {
					if (listError) throw listError;
					return folders;
				},
				createPersonal: async (name) => {
					if (createError) throw createError;
					const created = folderOf(`f${folders.length + 1}`, name);
					folders = [...folders, created];
					return created;
				},
			},
			onSessionEnded,
			log,
		});
	});

	it("is idle until loaded, then holds the server's folders", async () => {
		expect(inEnglishDeep(list.current())).toEqual({ status: "idle" });
		expect(list.folders()).toEqual([]);

		const loading = list.load();
		expect(inEnglishDeep(list.current())).toEqual({ status: "loading" });
		await loading;

		expect(inEnglishDeep(list.current())).toEqual({ status: "loaded", folders });
		expect(list.folders()).toEqual(folders);
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The folders couldn't be loaded."],
	])("reports %s", async (_name, error, message) => {
		listError = error;

		await list.load();

		expect(inEnglishDeep(list.current())).toEqual({ status: "failed", message });
	});

	it("an ended session refreshes the login state", async () => {
		listError = new ApiError(401, {});

		await list.load();

		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	it("creates a folder and reloads the list", async () => {
		await list.load();

		const result = await list.create("Set pieces");

		expect(inEnglishDeep(result)).toEqual({ ok: true, folder: folderOf("f2", "Set pieces") });
		expect(list.folders().map((folder) => folder.name)).toEqual(["Breakouts", "Set pieces"]);
		expect(log.notify).toHaveBeenCalledWith('Created folder "Set pieces"', "info");
	});

	it("reports a taken name without touching the list", async () => {
		await list.load();
		createError = new ApiError(409, { type: FolderApi.DUPLICATE_NAME });

		const result = await list.create("breakouts");

		expect(inEnglishDeep(result)).toEqual({ ok: false, message: "A folder named “breakouts” already exists. Choose another name." });
		expect(inEnglishDeep(list.current())).toEqual({ status: "loaded", folders });
	});

	it("reports an ended session on create", async () => {
		createError = new ApiError(401, {});

		expect(inEnglishDeep(await list.create("Set pieces"))).toEqual({ ok: false, message: "Your session has ended. Please log in again." });
		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	it("reports any other failure on create", async () => {
		createError = new ApiError(500, {});

		expect(inEnglishDeep(await list.create("Set pieces"))).toEqual({ ok: false, message: "The folder couldn't be created." });
		expect(log.notify).toHaveBeenCalledWith("The folder couldn't be created.", "error");
	});

	it("works without the optional callbacks", async () => {
		const quiet = new FolderList({
			api: { listPersonal: async () => Promise.reject(new ApiError(401, {})), createPersonal: async () => Promise.reject(new ApiError(401, {})) },
		});

		await quiet.load();
		await expect(quiet.create("x")).resolves.toMatchObject({ ok: false });
	});
});
