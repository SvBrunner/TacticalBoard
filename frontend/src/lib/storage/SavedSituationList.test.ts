import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { summaryOf } from "$lib/testing/storageFakes";
import type { SituationSummary } from "./SituationApi";
import { SavedSituationList } from "./SavedSituationList";

describe("SavedSituationList", () => {
	let situations: SituationSummary[];
	let listError: Error | null;
	let deleteError: Error | null;
	let deleted: string[];
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let list: SavedSituationList;

	beforeEach(() => {
		situations = [summaryOf({ id: "a", title: "A" }), summaryOf({ id: "b", title: "B" })];
		listError = null;
		deleteError = null;
		deleted = [];
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		list = new SavedSituationList({
			api: {
				listPersonal: async () => {
					if (listError) throw listError;
					return situations;
				},
				delete: async (id) => {
					if (deleteError) throw deleteError;
					deleted.push(id);
					situations = situations.filter((situation) => situation.id !== id);
				},
			},
			onSessionEnded,
			log,
		});
	});

	it("is idle until loaded, then holds the server's list", async () => {
		expect(list.current()).toEqual({ status: "idle" });

		const loading = list.load();
		expect(list.current()).toEqual({ status: "loading" });
		await loading;

		expect(list.current()).toEqual({ status: "loaded", situations });
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The saved situations couldn't be loaded."],
	])("reports %s", async (_name, error, message) => {
		listError = error;

		await list.load();

		expect(list.current()).toEqual({ status: "failed", message });
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

		expect(list.current()).toEqual({ status: "failed", message: '"A" couldn\'t be deleted.' });
		expect(log.notify).toHaveBeenCalledWith('"A" couldn\'t be deleted.', "error");
	});

	it("works without the optional callbacks", async () => {
		const quiet = new SavedSituationList({
			api: { listPersonal: async () => Promise.reject(new ApiError(401, {})), delete: async () => undefined },
		});

		await quiet.load();
		await expect(quiet.delete(summaryOf())).resolves.toBe(true);
	});
});
