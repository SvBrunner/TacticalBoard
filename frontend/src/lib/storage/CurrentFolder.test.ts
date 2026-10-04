import { inEnglishDeep } from "$lib/testing/i18n";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import { FolderApi, type Folder } from "./FolderApi";
import { CurrentFolder } from "./CurrentFolder";

const setPieces: Folder = { id: "f1", name: "Set pieces", createdAt: "2026-10-04T08:00:00Z", updatedAt: "2026-10-04T08:00:00Z" };

describe("CurrentFolder", () => {
	let getResult: Folder | Error;
	let renameResult: Folder | Error | null;
	let deleteError: Error | null;
	let calls: string[];
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let confirm: ReturnType<typeof vi.fn<(request: ConfirmationRequest) => Promise<boolean>>>;
	let folder: CurrentFolder;

	beforeEach(() => {
		getResult = setPieces;
		renameResult = null;
		deleteError = null;
		calls = [];
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		confirm = vi.fn(async () => true);
		folder = new CurrentFolder({
			id: "f1",
			api: {
				get: async (id) => {
					calls.push(`get ${id}`);
					if (getResult instanceof Error) throw getResult;
					return getResult;
				},
				rename: async (id, name) => {
					calls.push(`rename ${id} ${name}`);
					if (renameResult instanceof Error) throw renameResult;
					return renameResult ?? { ...setPieces, name };
				},
				delete: async (id) => {
					calls.push(`delete ${id}`);
					if (deleteError) throw deleteError;
				},
			},
			onSessionEnded,
			log,
		});
	});

	it("is loading until loaded, then holds the folder", async () => {
		expect(inEnglishDeep(folder.current())).toEqual({ status: "loading" });
		expect(folder.name()).toBeNull();

		await folder.load();

		expect(inEnglishDeep(folder.current())).toEqual({ status: "loaded", folder: setPieces });
		expect(folder.name()).toBe("Set pieces");
		expect(calls).toEqual(["get f1"]);
	});

	it("knows a folder that doesn't exist (any more)", async () => {
		getResult = new ApiError(404, { type: FolderApi.NOT_FOUND });

		await folder.load();

		expect(inEnglishDeep(folder.current())).toEqual({ status: "missing" });
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The folder couldn't be loaded."],
	])("reports %s while loading", async (_name, error, message) => {
		getResult = error;

		await folder.load();

		expect(inEnglishDeep(folder.current())).toEqual({ status: "failed", message });
	});

	it("an ended session refreshes the login state", async () => {
		getResult = new ApiError(401, {});

		await folder.load();

		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	describe("rename", () => {
		beforeEach(async () => {
			await folder.load();
		});

		it("renames and shows the new name", async () => {
			const result = await folder.rename("Breakouts");

			expect(inEnglishDeep(result)).toEqual({ ok: true, folder: { ...setPieces, name: "Breakouts" } });
			expect(folder.name()).toBe("Breakouts");
			expect(log.notify).toHaveBeenCalledWith('Renamed folder to "Breakouts"', "info");
		});

		it("reports a taken name and keeps the old one", async () => {
			renameResult = new ApiError(409, { type: FolderApi.DUPLICATE_NAME });

			const result = await folder.rename("Breakouts");

			expect(inEnglishDeep(result)).toEqual({ ok: false, message: "A folder named “Breakouts” already exists. Choose another name." });
			expect(folder.name()).toBe("Set pieces");
		});

		it("notices a folder deleted meanwhile", async () => {
			renameResult = new ApiError(404, { type: FolderApi.NOT_FOUND });

			const result = await folder.rename("Breakouts");

			expect(inEnglishDeep(result)).toEqual({ ok: false, message: "This folder no longer exists." });
			expect(inEnglishDeep(folder.current())).toEqual({ status: "missing" });
		});
	});

	describe("delete", () => {
		beforeEach(async () => {
			await folder.load();
		});

		it("deletes the folder", async () => {
			expect(inEnglishDeep(await folder.delete())).toEqual({ ok: true });

			expect(calls).toContain("delete f1");
			expect(inEnglishDeep(folder.current())).toEqual({ status: "missing" });
			expect(log.notify).toHaveBeenCalledWith('Deleted folder "Set pieces"', "info");
		});

		it("passes on why a folder with situations can't be deleted", async () => {
			deleteError = new ApiError(409, { type: FolderApi.NOT_EMPTY });

			expect(inEnglishDeep(await folder.delete())).toEqual({
				ok: false,
				message: "“Set pieces” can't be deleted because it still contains situations. Move or delete them first.",
			});
			expect(folder.name()).toBe("Set pieces");
		});

		it("treats a folder that is already gone as deleted", async () => {
			deleteError = new ApiError(404, { type: FolderApi.NOT_FOUND });

			expect(inEnglishDeep(await folder.delete())).toEqual({ ok: true });
			expect(inEnglishDeep(folder.current())).toEqual({ status: "missing" });
		});

		it("reports other failures", async () => {
			deleteError = new ApiUnavailableError();

			expect(inEnglishDeep(await folder.delete())).toEqual({ ok: false, message: "The server is not reachable. Please try again later." });

			deleteError = new ApiError(500, {});
			expect(inEnglishDeep(await folder.delete())).toEqual({ ok: false, message: "“Set pieces” couldn't be deleted." });
		});

		it("refuses at once, with the reason, when the folder is known to contain situations", async () => {
			const outcome = await folder.requestDelete({ containsSituations: true, confirm });

			expect(inEnglishDeep(outcome)).toEqual({ status: "refused", message: expect.stringContaining("still contains situations") });
			expect(confirm).not.toHaveBeenCalled();
			expect(calls).not.toContain("delete f1");
		});

		it("asks “Delete folder?” before deleting an empty folder", async () => {
			const outcome = await folder.requestDelete({ containsSituations: false, confirm });

			expect(inEnglishDeep(confirm.mock.calls[0][0])).toEqual({
				title: "Delete folder?",
				message: "“Set pieces” will be deleted.",
				confirmLabel: "Delete",
				cancelLabel: "Cancel",
			});
			expect(inEnglishDeep(outcome)).toEqual({ status: "deleted" });
			expect(calls).toContain("delete f1");
		});

		it("keeps the folder when the question is cancelled", async () => {
			confirm.mockResolvedValue(false);

			expect(inEnglishDeep(await folder.requestDelete({ containsSituations: false, confirm }))).toEqual({ status: "cancelled" });
			expect(calls).not.toContain("delete f1");
		});

		it("passes on the server's refusal (situations got into it meanwhile)", async () => {
			deleteError = new ApiError(409, { type: FolderApi.NOT_EMPTY });

			expect(inEnglishDeep(await folder.requestDelete({ containsSituations: false, confirm }))).toEqual({
				status: "refused",
				message: expect.stringContaining("still contains situations"),
			});
		});
	});

	it("names an unloaded folder generically", async () => {
		expect(inEnglishDeep(await folder.requestDelete({ containsSituations: true, confirm }))).toEqual({
			status: "refused",
			message: "The folder can't be deleted because it still contains situations. Move or delete them first.",
		});
	});

	it("works without the optional callbacks", async () => {
		const quiet = new CurrentFolder({
			id: "f1",
			api: {
				get: async () => Promise.reject(new ApiError(401, {})),
				rename: async () => Promise.reject(new ApiError(401, {})),
				delete: async () => Promise.reject(new ApiError(401, {})),
			},
		});

		await quiet.load();
		await expect(quiet.rename("x")).resolves.toMatchObject({ ok: false });
		await expect(quiet.delete()).resolves.toMatchObject({ ok: false });
	});
});
