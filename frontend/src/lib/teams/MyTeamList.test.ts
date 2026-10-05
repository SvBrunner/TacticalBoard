import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { inEnglishDeep } from "$lib/testing/i18n";
import { MyTeamList } from "./MyTeamList";
import { TeamApi, type MyTeam, type Team } from "./TeamApi";

function teamOf(code: string, name: string, role: MyTeam["role"] = "admin"): MyTeam {
	return { id: code.toLowerCase(), code, name, logoUrl: null, role, pendingJoinRequests: role === "admin" ? 0 : null };
}

describe("MyTeamList", () => {
	let teams: MyTeam[];
	let listError: Error | null;
	let createError: Error | null;
	let created: { name: string; logo: File | null }[];
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: {
		notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>>;
	};
	let list: MyTeamList;

	beforeEach(() => {
		teams = [teamOf("AAAAAA", "Lions")];
		listError = null;
		createError = null;
		created = [];
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		list = new MyTeamList({
			api: {
				listMine: async () => {
					if (listError) throw listError;
					return teams;
				},
				create: async (name, logo): Promise<Team> => {
					if (createError) throw createError;
					created.push({ name, logo });
					const team = teamOf("BBBBBB", name);
					teams = [...teams, team];
					return { ...team, createdAt: "2026-10-04T08:00:00Z", joinRequestPending: false };
				},
			},
			onSessionEnded,
			log,
		});
	});

	it("is idle until loaded, then holds the server's teams", async () => {
		expect(list.current()).toEqual({ status: "idle" });

		const loading = list.load();
		expect(list.current()).toEqual({ status: "loading" });
		await loading;

		expect(list.current()).toEqual({ status: "loaded", teams });
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The teams couldn't be loaded."],
	])("reports %s", async (_name, error, message) => {
		listError = error;

		await list.load();

		expect(inEnglishDeep(list.current())).toEqual({
			status: "failed",
			message,
		});
		expect(log.notify).toHaveBeenCalledWith(message, "error");
	});

	it("an ended session refreshes the login state", async () => {
		listError = new ApiError(401, {});

		await list.load();

		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	it("creates a team with its logo and reloads the list", async () => {
		const logo = new File([new Uint8Array(1)], "logo.png", {
			type: "image/png",
		});

		const result = await list.create("Tigers", logo);

		expect(result).toMatchObject({
			ok: true,
			team: { code: "BBBBBB", name: "Tigers" },
		});
		expect(created).toEqual([{ name: "Tigers", logo }]);
		expect(list.current()).toMatchObject({
			status: "loaded",
			teams: [{ name: "Lions" }, { name: "Tigers" }],
		});
		expect(log.notify).toHaveBeenCalledWith('Created team "Tigers" (BBBBBB)', "info");
	});

	it("says when the name is taken", async () => {
		createError = new ApiError(409, { type: TeamApi.DUPLICATE_NAME });

		const result = await list.create("Lions", null);

		expect(inEnglishDeep(result)).toEqual({
			ok: false,
			message: "A team named “Lions” already exists. Choose another name.",
		});
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["another error", new ApiError(500, {}), "The team couldn't be created."],
	])("reports a failed create: %s", async (_name, error, message) => {
		createError = error;

		expect(inEnglishDeep(await list.create("Lions", null))).toEqual({
			ok: false,
			message,
		});
	});
});
