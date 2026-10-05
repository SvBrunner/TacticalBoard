import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient, ApiError } from "$lib/api/ApiClient";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { SituationApi } from "./SituationApi";
import { teamArea } from "./Area";
import { inFolder, teamTopLevel, TOP_LEVEL } from "./SaveTarget";

const summary = {
	id: "s1",
	title: "Powerplay",
	sport: "floorball",
	fieldType: "full",
	folderId: null,
	revision: 2,
	createdAt: "2026-10-04T08:00:00+00:00",
	createdBy: { id: "u1", displayName: "Alice" },
	updatedAt: "2026-10-04T09:00:00+00:00",
	updatedBy: { id: "u2", displayName: null },
	area: { kind: "personal", id: "u1" },
	canWrite: true,
};

describe("SituationApi", () => {
	let server: FakeFetch;
	let api: SituationApi;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		api = new SituationApi(new ApiClient(server.fetch));
	});

	it("lists and creates at the top level of a team's area", async () => {
		const team = { ...summary, area: { kind: "team", id: "t1" }, canWrite: false };
		server.on("GET", "/api/teams/t1/situations", jsonResponse(200, [team]));
		server.on("POST", "/api/teams/t1/situations", jsonResponse(201, { ...team, canWrite: true, document: {} }));

		await expect(api.list(teamTopLevel("t1"))).resolves.toEqual([team]);
		await expect(api.create({ format: "doc" }, "new", teamTopLevel("t1"))).resolves.toMatchObject({ canWrite: true });
		const [request] = server.requestsTo("/api/teams/t1/situations").filter((r) => r.method === "POST");
		expect(JSON.parse(request.body!)).toEqual({ document: { format: "doc" }, origin: "new" });
	});

	it("lists the top level of the personal area", async () => {
		server.on("GET", "/api/personal-area/situations", jsonResponse(200, [summary]));

		await expect(api.list(TOP_LEVEL)).resolves.toEqual([summary]);
	});

	it("lists a folder", async () => {
		server.on("GET", "/api/folders/f1/situations", jsonResponse(200, [{ ...summary, folderId: "f1" }]));

		await expect(api.list(inFolder("f1"))).resolves.toEqual([{ ...summary, folderId: "f1" }]);
	});

	it("has a collection path per place, with the folder id encoded", () => {
		expect(SituationApi.collectionPath(TOP_LEVEL)).toBe("/api/personal-area/situations");
		expect(SituationApi.collectionPath(inFolder("a/b"))).toBe("/api/folders/a%2Fb/situations");
		expect(SituationApi.collectionPath(inFolder("f1", teamArea("t1")))).toBe("/api/folders/f1/situations");
		expect(SituationApi.collectionPath(teamTopLevel("t/1"))).toBe("/api/teams/t%2F1/situations");
	});

	it("gets one situation with its document", async () => {
		server.on("GET", "/api/situations/s1", jsonResponse(200, { ...summary, document: { format: "x" } }));

		await expect(api.get("s1")).resolves.toMatchObject({ id: "s1", document: { format: "x" } });
	});

	it("encodes the id in the path", () => {
		expect(SituationApi.situationPath("a/b")).toBe("/api/situations/a%2Fb");
	});

	it("creates with the document and its origin, through the antiforgery header", async () => {
		server.on("POST", "/api/personal-area/situations", jsonResponse(201, { ...summary, revision: 1, document: {} }));

		await api.create({ format: "doc" }, "imported", TOP_LEVEL);

		const [request] = server.requestsTo("/api/personal-area/situations").filter((r) => r.method === "POST");
		expect(JSON.parse(request.body!)).toEqual({ document: { format: "doc" }, origin: "imported" });
		expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
	});

	it("creates in a folder through the folder's collection", async () => {
		server.on("POST", "/api/folders/f1/situations", jsonResponse(201, { ...summary, folderId: "f1", revision: 1, document: {} }));

		await expect(api.create({ format: "doc" }, "new", inFolder("f1"))).resolves.toMatchObject({ folderId: "f1" });

		const [request] = server.requestsTo("/api/folders/f1/situations");
		expect(JSON.parse(request.body!)).toEqual({ document: { format: "doc" }, origin: "new" });
	});

	it("tells the server when a new situation has a default title", async () => {
		server.on("POST", SituationApi.PERSONAL_AREA_PATH, jsonResponse(201, { ...summary, revision: 1, document: {} }));

		await api.create({ format: "doc" }, "new", TOP_LEVEL, { titleIsDefault: true });

		const [request] = server.requestsTo(SituationApi.PERSONAL_AREA_PATH);
		expect(JSON.parse(request.body!)).toEqual({ document: { format: "doc" }, origin: "new", titleIsDefault: true });
	});

	it("moves with the target folder (or null) and no If-Match", async () => {
		server.on("PUT", "/api/situations/s1/folder", jsonResponse(200, { ...summary, folderId: "f1" }));

		await expect(api.move("s1", "f1")).resolves.toMatchObject({ folderId: "f1" });
		await api.move("s1", null);

		const requests = server.requestsTo("/api/situations/s1/folder");
		expect(requests.map((request) => JSON.parse(request.body!))).toEqual([{ folderId: "f1" }, { folderId: null }]);
		expect(requests[0].headers["If-Match"]).toBeUndefined();
		expect(requests[0].headers["X-CSRF-TOKEN"]).toBe("token-1");
	});

	it("updates with If-Match of the revision it is based on", async () => {
		server.on("PUT", "/api/situations/s1", jsonResponse(200, { ...summary, revision: 3, document: {} }));

		await expect(api.update("s1", 2, { format: "doc" })).resolves.toMatchObject({ revision: 3 });

		const [request] = server.requestsTo("/api/situations/s1");
		expect(request.headers["If-Match"]).toBe('"2"');
		expect(JSON.parse(request.body!)).toEqual({ document: { format: "doc" } });
	});

	it("reports a save conflict as an ApiError with the current revision", async () => {
		server.on("PUT", "/api/situations/s1", problemResponse(412, { type: SituationApi.SAVE_CONFLICT, currentRevision: 5 }));

		const error = await api.update("s1", 2, {}).catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).type).toBe(SituationApi.SAVE_CONFLICT);
		expect((error as ApiError).problem?.currentRevision).toBe(5);
	});

	it("deletes", async () => {
		server.on("DELETE", "/api/situations/s1", new Response(null, { status: 204 }));

		await expect(api.delete("s1")).resolves.toBeUndefined();
		expect(server.requestsTo("/api/situations/s1")[0].method).toBe("DELETE");
	});
});
