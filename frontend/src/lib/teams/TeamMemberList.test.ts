import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError } from "$lib/api/ApiClient";
import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import { inEnglishDeep } from "$lib/testing/i18n";
import { TeamApi, type TeamMember, type TeamRole } from "./TeamApi";
import { TeamMemberList } from "./TeamMemberList";

const alice: TeamMember = { userId: "u1", displayName: "Alice", role: "admin", joinedAt: "2026-10-04T08:00:00Z" };
const bob: TeamMember = { userId: "u2", displayName: "Bob", role: "reader", joinedAt: "2026-10-05T08:00:00Z" };

describe("TeamMemberList", () => {
	let api: {
		members: ReturnType<typeof vi.fn<(team: string) => Promise<TeamMember[]>>>;
		changeRole: ReturnType<typeof vi.fn<(team: string, userId: string, role: TeamRole) => Promise<TeamMember>>>;
		removeMember: ReturnType<typeof vi.fn<(team: string, userId: string) => Promise<void>>>;
	};
	let onAccessLost: ReturnType<typeof vi.fn<() => void>>;
	let onSessionEnded: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string, level?: string) => void>> };
	let list: TeamMemberList;

	beforeEach(() => {
		api = {
			members: vi.fn(async () => [alice, bob]),
			changeRole: vi.fn(async (_team, userId, role) => ({ ...(userId === "u1" ? alice : bob), role })),
			removeMember: vi.fn(async () => undefined),
		};
		onAccessLost = vi.fn();
		onSessionEnded = vi.fn();
		log = { notify: vi.fn() };
		list = new TeamMemberList({ api, key: "ABC123", onAccessLost, onSessionEnded, log });
	});

	it("loads the members of the team", async () => {
		expect(list.current()).toEqual({ status: "loading" });
		expect(list.members()).toEqual([]);

		await list.load();

		expect(api.members).toHaveBeenCalledWith("ABC123");
		expect(list.current()).toEqual({ status: "loaded", members: [alice, bob] });
	});

	it("reports a failed load and an ended session", async () => {
		api.members.mockRejectedValue(new ApiError(401, {}));

		await list.load();

		expect(inEnglishDeep(list.current())).toEqual({ status: "failed", message: "Your session has ended. Please log in again." });
		expect(onSessionEnded).toHaveBeenCalledOnce();
	});

	it("refreshes quietly", async () => {
		await list.load();
		const states: string[] = [];
		const unsubscribe = list.state.subscribe((state) => states.push(state.status));

		await list.load(true);
		unsubscribe();

		expect(states).toEqual(["loaded", "loaded"]);
	});

	it("changes a role, shows it in the list and loads the list again in the server's order", async () => {
		await list.load();
		api.members.mockClear();
		api.members.mockResolvedValue([alice, { ...bob, role: "editor" }]);

		const outcome = await list.changeRole(bob, "editor", "Lions");

		expect(api.changeRole).toHaveBeenCalledWith("ABC123", "u2", "editor");
		expect(outcome).toEqual({ ok: true, value: { ...bob, role: "editor" } });
		expect(list.members()).toEqual([alice, { ...bob, role: "editor" }]);
		expect(api.members).toHaveBeenCalledOnce();
	});

	it("knows which role changes are demotions", () => {
		expect(TeamMemberList.isDemotion("admin", "editor")).toBe(true);
		expect(TeamMemberList.isDemotion("admin", "reader")).toBe(true);
		expect(TeamMemberList.isDemotion("editor", "reader")).toBe(true);
		expect(TeamMemberList.isDemotion("reader", "editor")).toBe(false);
		expect(TeamMemberList.isDemotion("editor", "admin")).toBe(false);
		expect(TeamMemberList.isDemotion("admin", "admin")).toBe(false);
	});

	describe("giving oneself a lower role", () => {
		let confirm: ReturnType<typeof vi.fn<(request: ConfirmationRequest) => Promise<boolean>>>;

		beforeEach(async () => {
			confirm = vi.fn(async () => true);
			list = new TeamMemberList({ api, key: "ABC123", currentUserId: () => "u1", confirm, log });
			await list.load();
		});

		it("asks first, naming the team and the new role, and changes it when confirmed", async () => {
			const outcome = await list.changeRole(alice, "editor", "Lions");

			expect(confirm).toHaveBeenCalledOnce();
			expect(inEnglishDeep(confirm.mock.calls[0][0])).toEqual({
				title: "Change your own role?",
				message: "You'll be Editor in “Lions” and lose the rights of your current role at once. Only an Admin can give them back.",
				confirmLabel: "Change role",
				cancelLabel: "Cancel",
			});
			expect(outcome?.ok).toBe(true);
			expect(api.changeRole).toHaveBeenCalledWith("ABC123", "u1", "editor");
		});

		it("changes nothing when cancelled", async () => {
			confirm.mockResolvedValue(false);

			await expect(list.changeRole(alice, "reader", "Lions")).resolves.toBeNull();

			expect(api.changeRole).not.toHaveBeenCalled();
		});

		it("doesn't ask for other members or for a higher own role", async () => {
			await list.changeRole(bob, "reader", "Lions");
			await list.changeRole({ ...bob, userId: "u1", role: "reader" }, "admin", "Lions");

			expect(confirm).not.toHaveBeenCalled();
			expect(api.changeRole).toHaveBeenCalledTimes(2);
		});
	});

	it("words the last-Admin rule with the team's name and loads the list again", async () => {
		await list.load();
		api.changeRole.mockRejectedValue(new ApiError(409, { type: TeamApi.LAST_ADMIN }));
		api.members.mockClear();

		expect(inEnglishDeep(await list.changeRole(alice, "reader", "Lions"))).toEqual({
			ok: false,
			message: "“Lions” needs at least one Admin. Make another member Admin first.",
		});
		expect(api.members).toHaveBeenCalledOnce();
		expect(onAccessLost).not.toHaveBeenCalled();
		expect(log.notify).toHaveBeenCalledWith("“Lions” needs at least one Admin. Make another member Admin first.", "error");
	});

	it("removes a member from the list", async () => {
		await list.load();

		expect(await list.remove(bob, "Lions")).toEqual({ ok: true, value: bob });

		expect(api.removeMember).toHaveBeenCalledWith("ABC123", "u2");
		expect(list.members()).toEqual([alice]);
	});

	it("tells the page when the user lost their rights", async () => {
		await list.load();
		api.removeMember.mockRejectedValue(new ApiError(403, { type: TeamApi.FORBIDDEN }));

		expect(inEnglishDeep(await list.remove(bob, "Lions"))).toEqual({ ok: false, message: "You may not do this." });
		expect(onAccessLost).toHaveBeenCalledOnce();
		expect(list.members()).toEqual([alice, bob]);
	});

	it("falls back to its own messages", async () => {
		await list.load();
		api.removeMember.mockRejectedValue(new ApiError(500, {}));
		api.changeRole.mockRejectedValue(new ApiError(500, {}));

		expect(inEnglishDeep(await list.remove(bob, "Lions"))).toEqual({ ok: false, message: "The member couldn't be removed." });
		expect(inEnglishDeep(await list.changeRole(bob, "admin", "Lions"))).toEqual({ ok: false, message: "The role couldn't be changed." });
	});
});
