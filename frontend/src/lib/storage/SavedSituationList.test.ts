import { inEnglishDeep } from "$lib/testing/i18n";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { summaryOf } from "$lib/testing/storageFakes";
import { FolderApi } from "./FolderApi";
import type { SituationSummary } from "./SituationApi";
import { SavedSituationList } from "./SavedSituationList";
import { inFolder, TOP_LEVEL, type SaveTarget } from "./SaveTarget";

describe("SavedSituationList", () => {
	let situations: SituationSummary[];
	let listError: Error | null;
	let deleteError: Error | null;
	let moveError: Error | null;
	let deleted: string[];
	let listedPlaces: SaveTarget[];
	let moves: [string, string | null][];
	let link: { relocate: ReturnType<typeof vi.fn<(id: string, folderId: string | null) => void>> };
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let list: SavedSituationList;

	function listAt(place: SaveTarget) {
		return new SavedSituationList({
			api: {
				list: async (where) => {
					listedPlaces.push(where);
					if (listError) throw listError;
					return situations;
				},
				delete: async (id) => {
					if (deleteError) throw deleteError;
					deleted.push(id);
					situations = situations.filter((situation) => situation.id !== id);
				},
				move: async (id, folderId) => {
					if (moveError) throw moveError;
					moves.push([id, folderId]);
					const moved = situations.find((situation) => situation.id === id)!;
					situations = situations.filter((situation) => situation.id !== id);
					return { ...moved, folderId };
				},
			},
			place,
			link,
			onSessionEnded,
			log,
		});
	}

	beforeEach(() => {
		situations = [summaryOf({ id: "a", title: "A" }), summaryOf({ id: "b", title: "B" })];
		listError = null;
		deleteError = null;
		moveError = null;
		deleted = [];
		listedPlaces = [];
		moves = [];
		link = { relocate: vi.fn() };
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		list = listAt(TOP_LEVEL);
	});

	it("is idle until loaded, then holds the server's list", async () => {
		expect(inEnglishDeep(list.current())).toEqual({ status: "idle" });
		expect(list.situations()).toEqual([]);

		const loading = list.load();
		expect(inEnglishDeep(list.current())).toEqual({ status: "loading" });
		await loading;

		expect(inEnglishDeep(list.current())).toEqual({ status: "loaded", situations });
		expect(list.situations()).toEqual(situations);
		expect(listedPlaces).toEqual([TOP_LEVEL]);
	});

	it("lists its place: a folder", async () => {
		await listAt(inFolder("f1")).load();

		expect(listedPlaces).toEqual([{ folderId: "f1" }]);
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The saved situations couldn't be loaded."],
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

	it("deletes a situation and reloads the list", async () => {
		await list.load();

		await expect(list.delete(situations[0])).resolves.toBe(true);

		expect(deleted).toEqual(["a"]);
		expect(list.current()).toMatchObject({ status: "loaded", situations: [{ id: "b" }] });
		expect(log.notify).toHaveBeenCalledWith('Deleted "A"', "info");
	});

	it("treats an already deleted situation as deleted", async () => {
		deleteError = new ApiError(404, {});

		await expect(list.delete(situations[0])).resolves.toBe(true);

		expect(list.current().status).toBe("loaded");
	});

	it("reports a failed delete", async () => {
		deleteError = new ApiError(500, {});

		await expect(list.delete(situations[0])).resolves.toBe(false);

		expect(inEnglishDeep(list.current())).toEqual({ status: "failed", message: '“A” couldn\'t be deleted.' });
		expect(log.notify).toHaveBeenCalledWith('“A” couldn\'t be deleted.', "error");
	});

	it("moves a situation, tells the editor's link and reloads the list without it", async () => {
		await list.load();

		await expect(list.move(situations[0], "f1")).resolves.toBe(true);

		expect(moves).toEqual([["a", "f1"]]);
		expect(link.relocate).toHaveBeenCalledWith("a", "f1");
		expect(list.current()).toMatchObject({ status: "loaded", situations: [{ id: "b" }] });
		expect(log.notify).toHaveBeenCalledWith('Moved "A" to folder f1', "info");
	});

	it("moves a situation to the top level", async () => {
		await listAt(inFolder("f1")).move(situations[1], null);

		expect(moves).toEqual([["b", null]]);
		expect(log.notify).toHaveBeenCalledWith('Moved "B" to the top level', "info");
	});

	it.each<[string, Error, string]>([
		["a folder that is gone", new ApiError(404, { type: FolderApi.NOT_FOUND }), '“A” couldn\'t be moved: the folder no longer exists.'],
		["a situation that is gone", new ApiError(404, { type: "https://tacticalboard/errors/situation-not-found" }), '“A” couldn\'t be moved: it no longer exists.'],
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), '“A” couldn\'t be moved.'],
	])("reports a failed move: %s", async (_name, error, message) => {
		moveError = error;

		await expect(list.move(situations[0], "f1")).resolves.toBe(false);

		expect(inEnglishDeep(list.current())).toEqual({ status: "failed", message });
		expect(link.relocate).not.toHaveBeenCalled();
	});

	it("works without the optional callbacks", async () => {
		const quiet = new SavedSituationList({
			api: {
				list: async () => Promise.reject(new ApiError(401, {})),
				delete: async () => undefined,
				move: async (id, folderId) => summaryOf({ id, folderId }),
			},
			place: TOP_LEVEL,
		});

		await quiet.load();
		await expect(quiet.delete(summaryOf())).resolves.toBe(true);
		await expect(quiet.move(summaryOf(), "f1")).resolves.toBe(true);
	});
});
