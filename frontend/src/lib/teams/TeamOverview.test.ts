import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { inEnglishDeep } from "$lib/testing/i18n";
import type { TeamSearchPage, TeamSummary } from "./TeamApi";
import { TeamOverview } from "./TeamOverview";

function teamOf(index: number): TeamSummary {
	return {
		id: `t${index}`,
		code: `AAAA${String(index).padStart(2, "0")}`,
		name: `Team ${index}`,
		logoUrl: null,
	};
}

const ALL = Array.from({ length: 5 }, (_, index) => teamOf(index + 1));

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("TeamOverview", () => {
	let searches: { text: string; offset: number; limit: number }[];
	let failWith: Error | null;
	let scheduled: { run: () => void; delay: number; cancelled: boolean }[];
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: {
		notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>>;
	};
	let overview: TeamOverview;

	function search(text: string, offset: number, limit: number): Promise<TeamSearchPage> {
		searches.push({ text, offset, limit });
		if (failWith) {
			return Promise.reject(failWith);
		}
		const matches = ALL.filter((team) => team.name.toLowerCase().includes(text.toLowerCase()) || team.code.includes(text.toUpperCase()));
		return Promise.resolve({
			items: matches.slice(offset, offset + limit),
			total: matches.length,
			offset,
			limit,
		});
	}

	beforeEach(() => {
		searches = [];
		failWith = null;
		scheduled = [];
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		overview = new TeamOverview({
			api: { search: (text, offset, limit) => search(text, offset, limit) },
			pageSize: 2,
			schedule: (run, delay) => {
				const entry = { run, delay, cancelled: false };
				scheduled.push(entry);
				return () => {
					entry.cancelled = true;
				};
			},
			onSessionEnded,
			log,
		});
	});

	it("is idle until it searches, then lists the first page and the total", async () => {
		expect(overview.current()).toEqual({ status: "idle" });

		const loading = overview.search("  ");
		expect(overview.current()).toEqual({ status: "loading", query: "" });
		await loading;

		expect(overview.current()).toEqual({
			status: "loaded",
			query: "",
			teams: ALL.slice(0, 2),
			total: 5,
			loadingMore: false,
		});
		expect(searches).toEqual([{ text: "", offset: 0, limit: 2 }]);
	});

	it("searches with the trimmed text", async () => {
		await overview.search(" team 3 ");

		expect(overview.current()).toMatchObject({
			status: "loaded",
			query: "team 3",
			teams: [teamOf(3)],
			total: 1,
		});
	});

	it("shows more, page by page, until all are loaded", async () => {
		await overview.search("");

		await overview.showMore();
		expect(overview.current()).toMatchObject({
			teams: ALL.slice(0, 4),
			total: 5,
		});
		await overview.showMore();
		expect(overview.current()).toMatchObject({ teams: ALL, total: 5 });

		await overview.showMore();
		expect(searches.map((entry) => entry.offset)).toEqual([0, 2, 4]);
	});

	it("doesn't load more while not loaded or already loading more", async () => {
		await overview.showMore();
		expect(searches).toEqual([]);

		await overview.search("");
		const first = overview.showMore();
		expect(overview.current()).toMatchObject({ loadingMore: true });
		await overview.showMore();
		await first;

		expect(searches.map((entry) => entry.offset)).toEqual([0, 2]);
	});

	it("skips teams it already lists when the list shifted meanwhile", async () => {
		const api = {
			search: vi
				.fn()
				.mockResolvedValueOnce({
					items: ALL.slice(0, 2),
					total: 5,
					offset: 0,
					limit: 2,
				})
				// A team was created before the second page was loaded: the page starts with one already listed.
				.mockResolvedValueOnce({
					items: [ALL[1], ALL[2]],
					total: 6,
					offset: 2,
					limit: 2,
				}),
		};
		const shifted = new TeamOverview({ api, pageSize: 2 });

		await shifted.search("");
		await shifted.showMore();

		expect(shifted.current()).toMatchObject({
			teams: ALL.slice(0, 3),
			total: 6,
		});
	});

	it("searches while typing after a pause, only for the last text", async () => {
		overview.type("tea");
		overview.type("team 4");

		expect(scheduled.map((entry) => [entry.delay, entry.cancelled])).toEqual([
			[TeamOverview.TYPING_DELAY_MS, true],
			[TeamOverview.TYPING_DELAY_MS, false],
		]);
		expect(searches).toEqual([]);

		scheduled[1].run();
		await Promise.resolve();
		await Promise.resolve();

		expect(searches).toEqual([{ text: "team 4", offset: 0, limit: 2 }]);
	});

	it("a search cancels a pending typed search", async () => {
		overview.type("tea");

		await overview.search("team 1");

		expect(scheduled[0].cancelled).toBe(true);
	});

	it("ignores the answer to an older search", async () => {
		const first = deferred<TeamSearchPage>();
		const second = deferred<TeamSearchPage>();
		const api = {
			search: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
		};
		overview = new TeamOverview({ api, pageSize: 2 });

		const older = overview.search("a");
		const newer = overview.search("b");
		second.resolve({ items: [teamOf(2)], total: 1, offset: 0, limit: 2 });
		await newer;
		first.resolve({ items: [teamOf(1)], total: 1, offset: 0, limit: 2 });
		await older;

		expect(overview.current()).toMatchObject({
			query: "b",
			teams: [teamOf(2)],
		});
	});

	it("ignores a failure of an older search, and everything after dispose", async () => {
		const first = deferred<TeamSearchPage>();
		const api = {
			search: vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 2 }),
		};
		overview = new TeamOverview({ api, pageSize: 2 });

		const older = overview.search("a");
		await overview.search("b");
		first.reject(new ApiUnavailableError());
		await older;
		expect(overview.current()).toMatchObject({ status: "loaded", query: "b" });

		const late = deferred<TeamSearchPage>();
		api.search.mockReturnValueOnce(late.promise);
		const pending = overview.search("c");
		overview.dispose();
		late.resolve({ items: [teamOf(3)], total: 1, offset: 0, limit: 2 });
		await pending;
		expect(overview.current()).toMatchObject({ status: "loading", query: "c" });
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The teams couldn't be loaded."],
	])("reports %s", async (_name, error, message) => {
		failWith = error;

		await overview.search("x");

		expect(inEnglishDeep(overview.current())).toEqual({
			status: "failed",
			query: "x",
			message,
		});
		expect(log.notify).toHaveBeenCalledWith(message, "error");
		expect(onSessionEnded).toHaveBeenCalledTimes(error instanceof ApiError && error.status === 401 ? 1 : 0);
	});

	it("reports a failure to load more", async () => {
		await overview.search("");
		failWith = new ApiError(500, {});

		await overview.showMore();

		expect(inEnglishDeep(overview.current())).toEqual({
			status: "failed",
			query: "",
			message: "The teams couldn't be loaded.",
		});
	});

	it("waits with setTimeout by default", async () => {
		vi.useFakeTimers();
		try {
			const api = {
				search: vi.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 50 }),
			};
			const real = new TeamOverview({ api });

			real.type("lions");
			vi.advanceTimersByTime(TeamOverview.TYPING_DELAY_MS - 1);
			expect(api.search).not.toHaveBeenCalled();
			vi.advanceTimersByTime(1);

			expect(api.search).toHaveBeenCalledWith("lions", 0, 50);
		} finally {
			vi.useRealTimers();
		}
	});
});
