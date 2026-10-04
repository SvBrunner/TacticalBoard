import { describe, it, expect, beforeEach } from "vitest";
import { ApiClient, ApiError, ApiUnavailableError } from "./ApiClient";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";

describe("ApiClient", () => {
	let server: FakeFetch;
	let client: ApiClient;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		client = new ApiClient(server.fetch);
	});

	describe("get", () => {
		it("returns the parsed JSON body", async () => {
			server.on("GET", "/api/me", jsonResponse(200, { id: "1" }));

			await expect(client.get("/api/me")).resolves.toEqual({ id: "1" });
		});

		it("sends same-origin credentials and asks for JSON, without an antiforgery header", async () => {
			server.on("GET", "/api/me", jsonResponse(200, {}));

			await client.get("/api/me");

			const [request] = server.requestsTo("/api/me");
			expect(request.credentials).toBe("same-origin");
			expect(request.headers.Accept).toBe("application/json");
			expect(request.headers["X-CSRF-TOKEN"]).toBeUndefined();
			expect(server.requestsTo("/api/antiforgery")).toHaveLength(0);
		});

		it("turns a problem response into an ApiError with the problem", async () => {
			server.on("GET", "/api/me", problemResponse(401, { type: "https://tacticalboard/errors/unauthorized", title: "Unauthorized" }));

			const error = await client.get("/api/me").catch((e: unknown) => e);

			expect(error).toBeInstanceOf(ApiError);
			expect(error).toMatchObject({ status: 401, type: "https://tacticalboard/errors/unauthorized" });
			expect((error as ApiError).message).toBe("Unauthorized");
		});

		it("keeps an error without a readable body", async () => {
			server.on("GET", "/api/me", new Response("{broken", { status: 500, headers: { "Content-Type": "application/problem+json" } }));

			const error = (await client.get("/api/me").catch((e: unknown) => e)) as ApiError;

			expect(error).toBeInstanceOf(ApiError);
			expect(error.problem).toBeNull();
			expect(error.message).toBe("Request failed with status 500");
		});

		it("treats a network error as unavailable", async () => {
			server.failOn("GET", "/api/me");

			await expect(client.get("/api/me")).rejects.toBeInstanceOf(ApiUnavailableError);
		});

		it("treats a non-API error answer (e.g. the dev server without backend) as unavailable", async () => {
			server.on("GET", "/api/me", new Response("proxy error", { status: 500, headers: { "Content-Type": "text/plain" } }));

			await expect(client.get("/api/me")).rejects.toBeInstanceOf(ApiUnavailableError);
		});

		it("treats a successful non-JSON answer (e.g. the SPA fallback page) as unavailable", async () => {
			server.on("GET", "/api/me", new Response("<html>", { status: 200, headers: { "Content-Type": "text/html" } }));

			await expect(client.get("/api/me")).rejects.toBeInstanceOf(ApiUnavailableError);
		});

		it("treats unreadable JSON as unavailable", async () => {
			server.on("GET", "/api/me", new Response("{broken", { status: 200, headers: { "Content-Type": "application/json" } }));

			await expect(client.get("/api/me")).rejects.toBeInstanceOf(ApiUnavailableError);
		});
	});

	describe("send", () => {
		it("sends the JSON body with the antiforgery header", async () => {
			server.on("PUT", "/api/me/display-name", jsonResponse(200, { displayName: "Coach" }));

			await expect(client.send("PUT", "/api/me/display-name", { displayName: "Coach" })).resolves.toEqual({ displayName: "Coach" });

			const [request] = server.requestsTo("/api/me/display-name");
			expect(request.method).toBe("PUT");
			expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
			expect(request.headers["Content-Type"]).toBe("application/json");
			expect(request.body).toBe(JSON.stringify({ displayName: "Coach" }));
		});

		it("sends extra headers along (e.g. If-Match)", async () => {
			server.on("PUT", "/api/situations/1", jsonResponse(200, {}));

			await client.send("PUT", "/api/situations/1", {}, { "If-Match": '"3"' });

			const [request] = server.requestsTo("/api/situations/1");
			expect(request.headers["If-Match"]).toBe('"3"');
			expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
		});

		it("keeps the extra headers on the retry with a fresh token", async () => {
			let calls = 0;
			server.on("PUT", "/api/situations/1", () =>
				++calls === 1
					? problemResponse(400, { type: ApiClient.INVALID_ANTIFORGERY_TOKEN })
					: jsonResponse(200, {}),
			);

			await client.send("PUT", "/api/situations/1", {}, { "If-Match": '"3"' });

			expect(server.requestsTo("/api/situations/1").map((request) => request.headers["If-Match"])).toEqual(['"3"', '"3"']);
		});

		it("sends no body and no content type without a body", async () => {
			server.on("DELETE", "/api/things/1", new Response(null, { status: 204 }));

			await expect(client.send("DELETE", "/api/things/1")).resolves.toBeUndefined();

			const [request] = server.requestsTo("/api/things/1");
			expect(request.body).toBeUndefined();
			expect(request.headers["Content-Type"]).toBeUndefined();
		});

		it("fetches the token once and reuses it", async () => {
			server.on("POST", "/api/a", jsonResponse(200, {}));

			await client.send("POST", "/api/a", {});
			await client.send("POST", "/api/a", {});

			expect(server.requestsTo("/api/antiforgery")).toHaveLength(1);
		});

		it("retries once with a fresh token when the token was rejected", async () => {
			let calls = 0;
			server.on("GET", "/api/antiforgery", () => jsonResponse(200, { ...ANTIFORGERY, token: `token-${++calls}` }));
			server.on("POST", "/api/a", (request) =>
				request.headers["X-CSRF-TOKEN"] === "token-2"
					? jsonResponse(200, { done: true })
					: problemResponse(400, { type: ApiClient.INVALID_ANTIFORGERY_TOKEN }),
			);

			await expect(client.send("POST", "/api/a", {})).resolves.toEqual({ done: true });

			expect(server.requestsTo("/api/a")).toHaveLength(2);
		});

		it("gives up after the retry", async () => {
			server.on("POST", "/api/a", problemResponse(400, { type: ApiClient.INVALID_ANTIFORGERY_TOKEN }));

			await expect(client.send("POST", "/api/a", {})).rejects.toMatchObject({ type: ApiClient.INVALID_ANTIFORGERY_TOKEN });
			expect(server.requestsTo("/api/a")).toHaveLength(2);
		});

		it("doesn't retry other errors", async () => {
			server.on("PUT", "/api/a", problemResponse(400, { type: "https://tacticalboard/errors/validation-failed" }));

			await expect(client.send("PUT", "/api/a", {})).rejects.toBeInstanceOf(ApiError);
			expect(server.requestsTo("/api/a")).toHaveLength(1);
		});

		it("fails as unavailable when no token can be fetched, and tries again next time", async () => {
			server.failOn("GET", "/api/antiforgery");
			await expect(client.send("POST", "/api/a", {})).rejects.toBeInstanceOf(ApiUnavailableError);

			server.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
			server.on("POST", "/api/a", jsonResponse(200, {}));
			await expect(client.send("POST", "/api/a", {})).resolves.toEqual({});
		});
	});

	describe("antiforgery token", () => {
		it("is the backend's token with where to send it", async () => {
			await expect(client.antiforgeryToken()).resolves.toEqual(ANTIFORGERY);
		});

		it("is fetched again after being forgotten", async () => {
			await client.antiforgeryToken();
			client.forgetAntiforgeryToken();
			await client.antiforgeryToken();

			expect(server.requestsTo("/api/antiforgery")).toHaveLength(2);
		});
	});

	describe("ApiError", () => {
		it("exposes the first validation message of a field", () => {
			const error = new ApiError(400, { errors: { displayName: ["Too long.", "Other."] } });

			expect(error.fieldError("displayName")).toBe("Too long.");
			expect(error.fieldError("other")).toBeUndefined();
			expect(error.name).toBe("ApiError");
		});

		it("exposes the problem's stable code (only for the app's own types)", () => {
			expect(new ApiError(409, { type: "https://tacticalboard/errors/duplicate-title" }).code).toBe("duplicate-title");
			expect(new ApiError(409, { type: "https://example.org/other" }).code).toBeUndefined();
			expect(new ApiError(500, null).code).toBeUndefined();
		});

		it("lists the field errors' stable codes with their values, skipping malformed entries", () => {
			const error = new ApiError(400, {
				fieldErrors: {
					name: [{ code: "too-long", maxLength: 100 }, { nope: true } as never],
					title: [{ code: "required" }],
					broken: "x" as never,
				},
			});

			expect(error.fieldErrorCodes()).toEqual([
				["name", { code: "too-long", maxLength: 100 }],
				["title", { code: "required" }],
			]);
			expect(new ApiError(400, { errors: { a: ["One."] } }).fieldErrorCodes()).toEqual([]);
		});

		it("lists every validation message with its field", () => {
			const error = new ApiError(400, { errors: { a: ["One.", "Two."], b: ["Three."] } });

			expect(error.fieldErrors()).toEqual(["a: One.", "a: Two.", "b: Three."]);
			expect(new ApiError(500, null).fieldErrors()).toEqual([]);
		});

		it("exposes extension members of the problem", () => {
			expect(new ApiError(412, { currentRevision: 8 }).problem?.currentRevision).toBe(8);
		});

		it("prefers the detail as message", () => {
			expect(new ApiError(409, { title: "Conflict", detail: "Title exists." }).message).toBe("Title exists.");
		});
	});

	it("uses the global fetch by default", async () => {
		const original = globalThis.fetch;
		globalThis.fetch = server.fetch as typeof fetch;
		try {
			server.on("GET", "/api/me", jsonResponse(200, { id: "1" }));

			await expect(new ApiClient().get("/api/me")).resolves.toEqual({ id: "1" });
		} finally {
			globalThis.fetch = original;
		}
	});
});
