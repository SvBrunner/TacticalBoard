import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient, ApiError } from "$lib/api/ApiClient";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { TEAM_ROLES, TeamApi, type Team } from "./TeamApi";

const team: Team = {
	id: "t1",
	code: "ABC123",
	name: "Lions",
	logoUrl: null,
	createdAt: "2026-10-04T08:00:00+00:00",
	role: "admin",
	joinRequestPending: false,
	pendingJoinRequests: 0,
};

describe("TeamApi", () => {
	let server: FakeFetch;
	let api: TeamApi;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		api = new TeamApi(new ApiClient(server.fetch));
	});

	it("searches a page of teams by the trimmed text", async () => {
		const page = { items: [team], total: 1, offset: 0, limit: 50 };
		server.on("GET", "/api/teams?search=li+on&offset=0&limit=50", jsonResponse(200, page));

		await expect(api.search("  li on ")).resolves.toEqual(page);
	});

	it("lists all teams without a search text, from any offset", async () => {
		server.on("GET", "/api/teams?offset=50&limit=10", jsonResponse(200, { items: [], total: 50, offset: 50, limit: 10 }));

		await expect(api.search(" ", 50, 10)).resolves.toMatchObject({ total: 50 });
	});

	it("lists the current user's teams", async () => {
		server.on("GET", "/api/me/teams", jsonResponse(200, [{ ...team, role: "reader" }]));

		await expect(api.listMine()).resolves.toEqual([{ ...team, role: "reader" }]);
	});

	it("gets a team by its code, encoded in the path", async () => {
		server.on("GET", "/api/teams/ABC123", jsonResponse(200, team));

		await expect(api.get("ABC123")).resolves.toEqual(team);
		expect(TeamApi.teamPath("a/b")).toBe("/api/teams/a%2Fb");
		expect(TeamApi.logoPath("ABC123")).toBe("/api/teams/ABC123/logo");
	});

	it("creates a team as a form with the name and the logo file", async () => {
		server.on("POST", "/api/teams", jsonResponse(201, team));
		const logo = new File([new Uint8Array([1, 2, 3])], "lions.png", {
			type: "image/png",
		});

		await expect(api.create("Lions", logo)).resolves.toEqual(team);

		const [request] = server.requestsTo("/api/teams");
		expect(request.form?.get("name")).toBe("Lions");
		expect((request.form?.get("logo") as File).name).toBe("lions.png");
		expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
	});

	it("creates a team without a logo", async () => {
		server.on("POST", "/api/teams", jsonResponse(201, team));

		await api.create("Lions", null);

		expect(server.requestsTo("/api/teams")[0].form?.has("logo")).toBe(false);
	});

	it("renames with PUT and a JSON body", async () => {
		server.on("PUT", "/api/teams/ABC123", jsonResponse(200, { ...team, name: "Tigers" }));

		await expect(api.rename("ABC123", "Tigers")).resolves.toMatchObject({
			name: "Tigers",
		});
		expect(JSON.parse(server.requestsTo("/api/teams/ABC123")[0].body!)).toEqual({ name: "Tigers" });
	});

	it("sets the logo as a form and removes it with DELETE", async () => {
		server.on("PUT", "/api/teams/ABC123/logo", jsonResponse(200, { ...team, logoUrl: "/api/teams/ABC123/logo?v=1" }));
		server.on("DELETE", "/api/teams/ABC123/logo", new Response(null, { status: 204 }));
		const logo = new File([new Uint8Array([1])], "logo.webp", {
			type: "image/webp",
		});

		await expect(api.setLogo("ABC123", logo)).resolves.toMatchObject({
			logoUrl: "/api/teams/ABC123/logo?v=1",
		});
		await expect(api.removeLogo("ABC123")).resolves.toBeUndefined();

		const [put, del] = server.requestsTo("/api/teams/ABC123/logo");
		expect((put.form?.get("logo") as File).name).toBe("logo.webp");
		expect(del.method).toBe("DELETE");
	});

	it("reports a taken name as an ApiError with its type", async () => {
		server.on(
			"POST",
			"/api/teams",
			problemResponse(409, {
				type: TeamApi.DUPLICATE_NAME,
				existingName: "Lions",
			}),
		);

		const error = await api.create("Lions", null).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).type).toBe(TeamApi.DUPLICATE_NAME);
	});

	it("gets a team by its id too", async () => {
		server.on("GET", "/api/teams/0199a6d0-0000-7000-8000-00000000000a", jsonResponse(200, { ...team, code: null, role: null }));

		await expect(api.get("0199a6d0-0000-7000-8000-00000000000a")).resolves.toMatchObject({ code: null });
	});

	it("deletes a team with DELETE and the antiforgery header", async () => {
		server.on("DELETE", "/api/teams/ABC123", new Response(null, { status: 204 }));

		await expect(api.delete("ABC123")).resolves.toBeUndefined();

		expect(server.requestsTo("/api/teams/ABC123")[0]).toMatchObject({ method: "DELETE", headers: { "X-CSRF-TOKEN": "token-1" } });
	});

	it("lists members, changes a role, removes a member and leaves", async () => {
		const member = { userId: "u2", displayName: "Bob", role: "reader", joinedAt: "2026-10-05T08:00:00Z" };
		server.on("GET", "/api/teams/ABC123/members", jsonResponse(200, [member]));
		server.on("PUT", "/api/teams/ABC123/members/u2/role", jsonResponse(200, { ...member, role: "editor" }));
		server.on("DELETE", "/api/teams/ABC123/members/u2", new Response(null, { status: 204 }));
		server.on("DELETE", "/api/teams/ABC123/members/me", new Response(null, { status: 204 }));

		await expect(api.members("ABC123")).resolves.toEqual([member]);
		await expect(api.changeRole("ABC123", "u2", "editor")).resolves.toMatchObject({ role: "editor" });
		await expect(api.removeMember("ABC123", "u2")).resolves.toBeUndefined();
		await expect(api.leave("ABC123")).resolves.toBeUndefined();

		expect(JSON.parse(server.requestsTo("/api/teams/ABC123/members/u2/role")[0].body!)).toEqual({ role: "editor" });
		expect(server.requestsTo("/api/teams/ABC123/members/u2")[0].method).toBe("DELETE");
		expect(server.requestsTo("/api/teams/ABC123/members/me")[0].method).toBe("DELETE");
	});

	it("asks to join, lists, accepts and rejects join requests", async () => {
		const request = { id: "r1", user: { id: "u3", displayName: "Carol" }, requestedAt: "2026-10-05T09:00:00Z" };
		server.on("POST", "/api/teams/ABC123/join-requests", jsonResponse(201, request));
		server.on("GET", "/api/teams/ABC123/join-requests", jsonResponse(200, [request]));
		server.on("POST", "/api/teams/ABC123/join-requests/r1/accept", jsonResponse(200, { userId: "u3", displayName: "Carol", role: "reader", joinedAt: "x" }));
		server.on("POST", "/api/teams/ABC123/join-requests/r1/reject", new Response(null, { status: 204 }));

		await expect(api.requestToJoin("ABC123")).resolves.toEqual(request);
		await expect(api.joinRequests("ABC123")).resolves.toEqual([request]);
		await expect(api.acceptJoinRequest("ABC123", "r1")).resolves.toMatchObject({ role: "reader" });
		await expect(api.rejectJoinRequest("ABC123", "r1")).resolves.toBeUndefined();

		expect(server.requestsTo("/api/teams/ABC123/join-requests").map((recorded) => recorded.method)).toEqual(["POST", "GET"]);
	});

	it("knows the backend's problem types and limits", () => {
		expect(TeamApi.FORBIDDEN).toBe("https://tacticalboard/errors/forbidden");
		expect(TeamApi.LAST_ADMIN).toBe("https://tacticalboard/errors/last-team-admin");
		expect(TeamApi.MEMBER_NOT_FOUND).toBe("https://tacticalboard/errors/team-member-not-found");
		expect(TeamApi.JOIN_REQUEST_NOT_FOUND).toBe("https://tacticalboard/errors/join-request-not-found");
		expect(TeamApi.JOIN_REQUEST_PENDING).toBe("https://tacticalboard/errors/join-request-pending");
		expect(TeamApi.ALREADY_MEMBER).toBe("https://tacticalboard/errors/already-team-member");
		expect(TEAM_ROLES).toEqual(["admin", "editor", "reader"]);
		expect(TeamApi.DUPLICATE_NAME).toBe("https://tacticalboard/errors/duplicate-team-name");
		expect(TeamApi.NOT_FOUND).toBe("https://tacticalboard/errors/team-not-found");
		expect(TeamApi.MAX_NAME_LENGTH).toBe(64);
		expect(TeamApi.MAX_LOGO_BYTES).toBe(5 * 1024 * 1024);
		expect(TeamApi.LOGO_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
		expect(TeamApi.PAGE_SIZE).toBe(50);
	});
});
