import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError } from "$lib/api/ApiClient";
import { inEnglishDeep } from "$lib/testing/i18n";
import { TeamApi, type JoinRequest, type TeamMember } from "./TeamApi";
import { TeamJoinRequestList } from "./TeamJoinRequestList";

const carol: JoinRequest = { id: "r1", user: { id: "u3", displayName: "Carol" }, requestedAt: "2026-10-05T09:00:00Z" };
const dave: JoinRequest = { id: "r2", user: { id: "u4", displayName: "Dave" }, requestedAt: "2026-10-05T10:00:00Z" };
const carolMember: TeamMember = { userId: "u3", displayName: "Carol", role: "reader", joinedAt: "2026-10-05T11:00:00Z" };

describe("TeamJoinRequestList", () => {
	let api: {
		joinRequests: ReturnType<typeof vi.fn<(team: string) => Promise<JoinRequest[]>>>;
		acceptJoinRequest: ReturnType<typeof vi.fn<(team: string, requestId: string) => Promise<TeamMember>>>;
		rejectJoinRequest: ReturnType<typeof vi.fn<(team: string, requestId: string) => Promise<void>>>;
	};
	let onDecided: ReturnType<typeof vi.fn<() => void>>;
	let onAccessLost: ReturnType<typeof vi.fn<() => void>>;
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let list: TeamJoinRequestList;

	beforeEach(() => {
		api = {
			joinRequests: vi.fn(async () => [carol, dave]),
			acceptJoinRequest: vi.fn(async () => carolMember),
			rejectJoinRequest: vi.fn(async () => undefined),
		};
		onDecided = vi.fn();
		onAccessLost = vi.fn();
		onSessionEnded = vi.fn();
		list = new TeamJoinRequestList({ api, key: "ABC123", onDecided, onAccessLost, onSessionEnded, log: { notify: vi.fn() } });
	});

	it("loads the pending requests", async () => {
		expect(list.requests()).toEqual([]);

		await list.load();

		expect(api.joinRequests).toHaveBeenCalledWith("ABC123");
		expect(list.current()).toEqual({ status: "loaded", requests: [carol, dave] });
	});

	it("reports a failed load", async () => {
		api.joinRequests.mockRejectedValue(new ApiError(500, {}));

		await list.load();

		expect(inEnglishDeep(list.current())).toEqual({ status: "failed", message: "The join requests couldn't be loaded." });
	});

	it("accepts a request, drops it from the list and tells the page", async () => {
		await list.load();

		expect(await list.accept(carol, "Lions")).toEqual({ ok: true, value: carolMember });

		expect(api.acceptJoinRequest).toHaveBeenCalledWith("ABC123", "r1");
		expect(list.requests()).toEqual([dave]);
		expect(onDecided).toHaveBeenCalledOnce();
	});

	it("rejects a request", async () => {
		await list.load();

		expect(await list.reject(dave, "Lions")).toEqual({ ok: true, value: dave });

		expect(api.rejectJoinRequest).toHaveBeenCalledWith("ABC123", "r2");
		expect(list.requests()).toEqual([carol]);
	});

	it("says when another Admin decided the request meanwhile and loads the list again", async () => {
		await list.load();
		api.rejectJoinRequest.mockRejectedValue(new ApiError(404, { type: TeamApi.JOIN_REQUEST_NOT_FOUND }));
		api.joinRequests.mockResolvedValue([dave]);

		expect(inEnglishDeep(await list.reject(carol, "Lions"))).toEqual({
			ok: false,
			message: "This request was already decided or no longer exists.",
		});
		await Promise.resolve();
		await Promise.resolve();
		expect(list.requests()).toEqual([dave]);
		expect(onDecided).toHaveBeenCalledOnce();
	});

	it("tells the page when the user lost their rights, and an ended session", async () => {
		await list.load();
		api.acceptJoinRequest.mockRejectedValueOnce(new ApiError(403, { type: TeamApi.FORBIDDEN }));
		api.acceptJoinRequest.mockRejectedValueOnce(new ApiError(401, {}));

		expect(inEnglishDeep(await list.accept(carol, "Lions"))).toEqual({ ok: false, message: "You may not do this." });
		expect(onAccessLost).toHaveBeenCalledOnce();
		expect(inEnglishDeep(await list.accept(carol, "Lions"))).toEqual({ ok: false, message: "Your session has ended. Please log in again." });
		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	it("falls back to its own messages", async () => {
		await list.load();
		api.acceptJoinRequest.mockRejectedValue(new ApiError(500, {}));
		api.rejectJoinRequest.mockRejectedValue(new ApiError(500, {}));

		expect(inEnglishDeep(await list.accept(carol, "Lions"))).toEqual({ ok: false, message: "The request couldn't be accepted." });
		expect(inEnglishDeep(await list.reject(carol, "Lions"))).toEqual({ ok: false, message: "The request couldn't be rejected." });
	});
});
