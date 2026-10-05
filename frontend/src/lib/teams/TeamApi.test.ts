import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient, ApiError } from "$lib/api/ApiClient";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { TeamApi, type Team } from "./TeamApi";

const team: Team = {
	id: "t1",
	code: "ABC123",
	name: "Lions",
	logoUrl: null,
	createdAt: "2026-10-04T08:00:00+00:00",
	role: "admin",
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

	it("knows the backend's problem types and limits", () => {
		expect(TeamApi.DUPLICATE_NAME).toBe("https://tacticalboard/errors/duplicate-team-name");
		expect(TeamApi.NOT_FOUND).toBe("https://tacticalboard/errors/team-not-found");
		expect(TeamApi.MAX_NAME_LENGTH).toBe(64);
		expect(TeamApi.MAX_LOGO_BYTES).toBe(5 * 1024 * 1024);
		expect(TeamApi.LOGO_TYPES).toEqual(["image/png", "image/jpeg", "image/webp"]);
		expect(TeamApi.PAGE_SIZE).toBe(50);
	});
});
