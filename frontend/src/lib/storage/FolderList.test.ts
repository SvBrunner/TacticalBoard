import { inEnglishDeep } from "$lib/testing/i18n";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { FolderApi, type FolderSummary } from "./FolderApi";
import { PERSONAL_AREA, teamArea, type Area } from "./Area";
import { FolderList } from "./FolderList";

function folderOf(id: string, name: string, situationCount = 0): FolderSummary {
	return {
		id,
		name,
		createdAt: "2026-10-04T08:00:00Z",
		updatedAt: "2026-10-04T08:00:00Z",
		area: { kind: "personal", id: "u1" },
		canWrite: true,
		situationCount,
	};
}

describe("FolderList", () => {
	let folders: FolderSummary[];
	let listError: Error | null;
	let createError: Error | null;
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let list: FolderList;
	let areas: Area[];

	beforeEach(() => {
		areas = [];
		folders = [folderOf("f1", "Breakouts", 2)];
		listError = null;
		createError = null;
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		list = new FolderList({
			api: {
				list: async (area) => {
					areas.push(area);
					if (listError) throw listError;
					return folders;
				},
				create: async (area, name) => {
					areas.push(area);
					if (createError) throw createError;
					const created = folderOf(`f${folders.length + 1}`, name);
					folders = [...folders, created];
					return created;
				},
			},
			area: () => PERSONAL_AREA,
			onSessionEnded,
			log,
		});
	});

	it("lists and creates in its area, and waits while the area isn't known", async () => {
		let area: Area | null = null;
		const calls: string[] = [];
		const teamList = new FolderList({
			api: {
				list: async (where) => {
					calls.push(`list ${JSON.stringify(where)}`);
					return [];
				},
				create: async (where, name) => {
					calls.push(`create ${JSON.stringify(where)} ${name}`);
					return folderOf("f9", name);
				},
			},
			area: () => area,
		});

		await teamList.load();
		expect(teamList.current().status).toBe("idle");
		expect((await teamList.create("A")).ok).toBe(false);
		expect(calls).toEqual([]);

		area = teamArea("t1");
		await teamList.load();
		await teamList.create("A");
		expect(calls).toEqual(['list {"kind":"team","teamId":"t1"}', 'create {"kind":"team","teamId":"t1"} A', 'list {"kind":"team","teamId":"t1"}']);
	});

	it("is idle until loaded, then holds the server's folders", async () => {
		expect(inEnglishDeep(list.current())).toEqual({ status: "idle" });
		expect(list.folders()).toEqual([]);

		const loading = list.load();
		expect(inEnglishDeep(list.current())).toEqual({ status: "loading" });
		await loading;

		expect(inEnglishDeep(list.current())).toEqual({ status: "loaded", folders });
		expect(list.folders()).toEqual(folders);
		expect(areas).toEqual([PERSONAL_AREA]);
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
			area: () => PERSONAL_AREA,
			api: { list: async () => Promise.reject(new ApiError(401, {})), create: async () => Promise.reject(new ApiError(401, {})) },
		});

		await quiet.load();
		await expect(quiet.create("x")).resolves.toMatchObject({ ok: false });
	});
});
