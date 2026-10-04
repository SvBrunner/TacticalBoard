import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient, ApiError } from "$lib/api/ApiClient";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { SituationApi } from "./SituationApi";

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
};

describe("SituationApi", () => {
	let server: FakeFetch;
	let api: SituationApi;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		api = new SituationApi(new ApiClient(server.fetch));
	});

	it("lists the personal area", async () => {
		server.on("GET", "/api/personal-area/situations", jsonResponse(200, [summary]));

		await expect(api.listPersonal()).resolves.toEqual([summary]);
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

		await api.create({ format: "doc" }, "imported");

		const [request] = server.requestsTo("/api/personal-area/situations").filter((r) => r.method === "POST");
		expect(JSON.parse(request.body!)).toEqual({ document: { format: "doc" }, origin: "imported" });
		expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
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
