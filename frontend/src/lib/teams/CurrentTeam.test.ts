import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { inEnglishDeep } from "$lib/testing/i18n";
import { CurrentTeam } from "./CurrentTeam";
import { TeamApi, type Team } from "./TeamApi";

const lions: Team = {
	id: "t1",
	code: "ABC123",
	name: "Lions",
	logoUrl: "/api/teams/ABC123/logo?v=1",
	createdAt: "2026-10-04T08:00:00Z",
	role: "admin",
	joinRequestPending: false,
	pendingJoinRequests: 0,
};

describe("CurrentTeam", () => {
	let api: {
		get: ReturnType<typeof vi.fn<(code: string) => Promise<Team>>>;
		rename: ReturnType<typeof vi.fn<(code: string, name: string) => Promise<Team>>>;
		setLogo: ReturnType<typeof vi.fn<(code: string, logo: File) => Promise<Team>>>;
		removeLogo: ReturnType<typeof vi.fn<(code: string) => Promise<void>>>;
		requestToJoin: ReturnType<typeof vi.fn<(code: string) => Promise<unknown>>>;
		leave: ReturnType<typeof vi.fn<(code: string) => Promise<void>>>;
		delete: ReturnType<typeof vi.fn<(code: string) => Promise<void>>>;
	};
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: {
		notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>>;
	};
	let team: CurrentTeam;
	const logo = new File([new Uint8Array(1)], "logo.png", { type: "image/png" });

	beforeEach(() => {
		api = {
			get: vi.fn(async () => lions),
			rename: vi.fn(async (_code, name) => ({ ...lions, name })),
			setLogo: vi.fn(async () => ({
				...lions,
				logoUrl: "/api/teams/ABC123/logo?v=2",
			})),
			removeLogo: vi.fn(async () => undefined),
			requestToJoin: vi.fn(async () => ({})),
			leave: vi.fn(async () => undefined),
			delete: vi.fn(async () => undefined),
		};
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		team = new CurrentTeam({ api, key: "ABC123", onSessionEnded, log });
	});

	it("loads the team by its code", async () => {
		expect(team.current()).toEqual({ status: "loading" });
		expect(team.team()).toBeNull();

		await team.load();

		expect(api.get).toHaveBeenCalledWith("ABC123");
		expect(team.current()).toEqual({ status: "loaded", team: lions });
		expect(team.team()).toEqual(lions);
	});

	it("only Admins may change the team's details", async () => {
		await team.load();
		expect(team.canChangeDetails()).toBe(true);

		api.get.mockResolvedValue({ ...lions, role: "editor" });
		await team.load();
		expect(team.canChangeDetails()).toBe(false);

		api.get.mockResolvedValue({ ...lions, role: null });
		await team.load();
		expect(team.canChangeDetails()).toBe(false);
	});

	it("a team that doesn't exist is missing", async () => {
		api.get.mockRejectedValue(new ApiError(404, { type: TeamApi.NOT_FOUND }));

		await team.load();

		expect(team.current()).toEqual({ status: "missing" });
	});

	it.each<[string, Error, string]>([
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["another error", new ApiError(500, {}), "The team couldn't be loaded."],
	])("reports a failed load: %s", async (_name, error, message) => {
		api.get.mockRejectedValue(error);

		await team.load();

		expect(inEnglishDeep(team.current())).toEqual({
			status: "failed",
			message,
		});
	});

	it("renames the team and shows the new name", async () => {
		await team.load();

		const result = await team.rename("Tigers");

		expect(result).toEqual({ ok: true, team: { ...lions, name: "Tigers" } });
		expect(team.team()?.name).toBe("Tigers");
		expect(api.rename).toHaveBeenCalledWith("ABC123", "Tigers");
	});

	it("says when the new name is taken, or the team is gone", async () => {
		await team.load();
		api.rename.mockRejectedValueOnce(new ApiError(409, { type: TeamApi.DUPLICATE_NAME }));
		expect(inEnglishDeep(await team.rename("Bears"))).toEqual({
			ok: false,
			message: "A team named “Bears” already exists. Choose another name.",
		});
		expect(team.current().status).toBe("loaded");

		api.rename.mockRejectedValueOnce(new ApiError(404, { type: TeamApi.NOT_FOUND }));
		expect(inEnglishDeep(await team.rename("Bears"))).toEqual({
			ok: false,
			message: "This team no longer exists.",
		});
		expect(team.current()).toEqual({ status: "missing" });
	});

	it("an ended session refreshes the login state", async () => {
		api.rename.mockRejectedValue(new ApiError(401, {}));

		await team.rename("Tigers");

		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	it("sets the logo and shows the new one", async () => {
		await team.load();

		const result = await team.setLogo(logo);

		expect(result).toMatchObject({
			ok: true,
			team: { logoUrl: "/api/teams/ABC123/logo?v=2" },
		});
		expect(team.team()?.logoUrl).toBe("/api/teams/ABC123/logo?v=2");
		expect(api.setLogo).toHaveBeenCalledWith("ABC123", logo);
	});

	it("words the server's reason for a refused logo", async () => {
		await team.load();
		api.setLogo.mockRejectedValue(
			new ApiError(400, {
				type: "https://tacticalboard/errors/validation-failed",
				fieldErrors: { logo: [{ code: "unsupported-image" }] },
			}),
		);

		expect(inEnglishDeep(await team.setLogo(logo))).toEqual({
			ok: false,
			message: "The logo must be a PNG, JPEG or WebP image.",
		});

		api.setLogo.mockRejectedValue(new ApiError(500, {}));
		expect(inEnglishDeep(await team.setLogo(logo))).toEqual({
			ok: false,
			message: "The logo couldn't be saved.",
		});
	});

	it("removes the logo", async () => {
		await team.load();

		const result = await team.removeLogo();

		expect(result).toEqual({ ok: true, team: { ...lions, logoUrl: null } });
		expect(team.team()?.logoUrl).toBeNull();
		expect(api.removeLogo).toHaveBeenCalledWith("ABC123");
	});

	it("loads the team after removing the logo when it wasn't loaded yet", async () => {
		api.get.mockResolvedValue({ ...lions, logoUrl: null });

		const result = await team.removeLogo();

		expect(result).toEqual({ ok: true, team: { ...lions, logoUrl: null } });
	});

	it("reports a failed removal", async () => {
		await team.load();
		api.removeLogo.mockRejectedValue(new ApiError(403, { type: "https://tacticalboard/errors/forbidden" }));

		expect(inEnglishDeep(await team.removeLogo())).toEqual({
			ok: false,
			message: "You may not do this.",
		});
		expect(team.team()?.logoUrl).toBe(lions.logoUrl);
		expect(log.notify).toHaveBeenCalledWith("You may not do this.", "error");
	});

	it("refreshes quietly, keeping the loaded team on screen", async () => {
		await team.load();
		const states: string[] = [];
		const unsubscribe = team.state.subscribe((state) => states.push(state.status));

		await team.load(true);
		unsubscribe();

		expect(states).toEqual(["loaded", "loaded"]);
	});

	it("asks to join and then shows the pending request", async () => {
		const stranger = { ...lions, code: null, role: null, pendingJoinRequests: null };
		api.get.mockResolvedValue(stranger);
		await team.load();
		api.get.mockResolvedValue({ ...stranger, joinRequestPending: true });

		const result = await team.requestToJoin();

		expect(api.requestToJoin).toHaveBeenCalledWith("ABC123");
		expect(result).toEqual({ ok: true, value: { ...stranger, joinRequestPending: true } });
		expect(team.team()?.joinRequestPending).toBe(true);
	});

	it.each<[string, string, string]>([
		["pending", TeamApi.JOIN_REQUEST_PENDING, "You've already asked to join this team. An Admin will accept or reject your request."],
		["a member", TeamApi.ALREADY_MEMBER, "You're already a member of this team."],
	])("says when the user is %s already and shows the team as it is", async (_name, type, message) => {
		await team.load();
		api.requestToJoin.mockRejectedValue(new ApiError(409, { type }));
		api.get.mockClear();

		expect(inEnglishDeep(await team.requestToJoin())).toEqual({ ok: false, message });
		expect(api.get).toHaveBeenCalledOnce();
	});

	it("reports a failed request to join", async () => {
		await team.load();
		api.requestToJoin.mockRejectedValue(new ApiError(500, {}));

		expect(inEnglishDeep(await team.requestToJoin())).toEqual({ ok: false, message: "Your request couldn't be sent." });
	});

	it("leaves the team and then shows what non-members see", async () => {
		await team.load();
		const publicView = { ...lions, code: null, role: null, pendingJoinRequests: null };
		api.get.mockResolvedValue(publicView);

		const result = await team.leave();

		expect(api.leave).toHaveBeenCalledWith("ABC123");
		expect(result).toEqual({ ok: true, value: publicView });
		expect(team.team()?.role).toBeNull();
	});

	it("the last Admin can't leave and is told what to do instead", async () => {
		await team.load();
		api.leave.mockRejectedValue(new ApiError(409, { type: TeamApi.LAST_ADMIN }));

		expect(inEnglishDeep(await team.leave())).toEqual({
			ok: false,
			message: "You're the last Admin of “Lions”. Make another member Admin first, or delete the team.",
		});
		expect(team.team()?.role).toBe("admin");
	});

	it("a failed reload after leaving is reported", async () => {
		await team.load();
		api.get.mockRejectedValue(new ApiError(500, {}));

		expect(inEnglishDeep(await team.leave())).toEqual({ ok: false, message: "The team couldn't be loaded." });
	});

	it("deletes the team, which is then missing", async () => {
		await team.load();

		expect(await team.delete()).toEqual({ ok: true, value: null });

		expect(api.delete).toHaveBeenCalledWith("ABC123");
		expect(team.current()).toEqual({ status: "missing" });
	});

	it("reports a refused deletion and shows the team as it is now", async () => {
		await team.load();
		api.delete.mockRejectedValue(new ApiError(403, { type: TeamApi.FORBIDDEN }));
		api.get.mockResolvedValue({ ...lions, role: "reader" });

		expect(inEnglishDeep(await team.delete())).toEqual({ ok: false, message: "You may not do this." });
		await Promise.resolve();
		await Promise.resolve();
		expect(api.get).toHaveBeenCalledTimes(2);

		api.delete.mockRejectedValue(new ApiError(500, {}));
		expect(inEnglishDeep(await team.delete())).toEqual({ ok: false, message: "The team couldn't be deleted." });
	});
});
