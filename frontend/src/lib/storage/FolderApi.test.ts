import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient, ApiError } from "$lib/api/ApiClient";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { FolderApi } from "./FolderApi";

const folder = { id: "f1", name: "Set pieces", createdAt: "2026-10-04T08:00:00+00:00", updatedAt: "2026-10-04T08:00:00+00:00" };

describe("FolderApi", () => {
	let server: FakeFetch;
	let api: FolderApi;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		api = new FolderApi(new ApiClient(server.fetch));
	});

	it("lists the personal area's folders", async () => {
		server.on("GET", "/api/personal-area/folders", jsonResponse(200, [folder]));

		await expect(api.listPersonal()).resolves.toEqual([folder]);
	});

	it("gets one folder, with the id encoded in the path", async () => {
		server.on("GET", "/api/folders/f1", jsonResponse(200, folder));

		await expect(api.get("f1")).resolves.toEqual(folder);
		expect(FolderApi.folderPath("a/b")).toBe("/api/folders/a%2Fb");
	});

	it("creates with the name, through the antiforgery header", async () => {
		server.on("POST", "/api/personal-area/folders", jsonResponse(201, folder));

		await expect(api.createPersonal("Set pieces")).resolves.toEqual(folder);

		const [request] = server.requestsTo("/api/personal-area/folders").filter((r) => r.method === "POST");
		expect(JSON.parse(request.body!)).toEqual({ name: "Set pieces" });
		expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
	});

	it("renames with PUT", async () => {
		server.on("PUT", "/api/folders/f1", jsonResponse(200, { ...folder, name: "Breakouts" }));

		await expect(api.rename("f1", "Breakouts")).resolves.toMatchObject({ name: "Breakouts" });
		expect(JSON.parse(server.requestsTo("/api/folders/f1")[0].body!)).toEqual({ name: "Breakouts" });
	});

	it("deletes, and reports a non-empty folder as an ApiError", async () => {
		server.on("DELETE", "/api/folders/f1", new Response(null, { status: 204 }));
		await expect(api.delete("f1")).resolves.toBeUndefined();

		server.on("DELETE", "/api/folders/f1", problemResponse(409, { type: FolderApi.NOT_EMPTY }));
		const error = await api.delete("f1").catch((caught: unknown) => caught);

		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).type).toBe(FolderApi.NOT_EMPTY);
	});

	it("knows the problem types and the name limit of the backend", () => {
		expect(FolderApi.DUPLICATE_NAME).toBe("https://tacticalboard/errors/duplicate-folder-name");
		expect(FolderApi.NOT_EMPTY).toBe("https://tacticalboard/errors/folder-not-empty");
		expect(FolderApi.NOT_FOUND).toBe("https://tacticalboard/errors/folder-not-found");
		expect(FolderApi.MAX_NAME_LENGTH).toBe(100);
	});
});
