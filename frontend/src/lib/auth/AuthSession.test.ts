import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { ApiClient } from "$lib/api/ApiClient";
import { AuthSession, authSession, apiClient } from "./AuthSession";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import { de, inEnglishDeep, translateDeep } from "$lib/testing/i18n";

const ALICE = { id: "0199a6d0-0000-7000-8000-000000000001", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null };

describe("AuthSession", () => {
	let server: FakeFetch;
	let session: AuthSession;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		session = new AuthSession(new ApiClient(server.fetch));
	});

	describe("refresh", () => {
		it("starts unknown", () => {
			expect(get(session.state)).toEqual({ status: "unknown" });
			expect(session.current()).toEqual({ status: "unknown" });
		});

		it("is authenticated with the user from /api/me", async () => {
			server.on("GET", "/api/me", jsonResponse(200, ALICE));

			await expect(session.refresh()).resolves.toEqual({ status: "authenticated", user: ALICE });
			expect(get(session.state)).toEqual({ status: "authenticated", user: ALICE });
		});

		it("is anonymous on 401", async () => {
			server.on("GET", "/api/me", problemResponse(401, { type: "https://tacticalboard/errors/unauthorized" }));

			await expect(session.refresh()).resolves.toEqual({ status: "anonymous" });
		});

		it("is quietly unavailable when there is no backend", async () => {
			server.failOn("GET", "/api/me");

			await expect(session.refresh()).resolves.toEqual({ status: "unavailable" });
		});

		it("is unavailable on any other answer", async () => {
			server.on("GET", "/api/me", problemResponse(500, { type: "https://tacticalboard/errors/internal-error" }));

			await expect(session.refresh()).resolves.toEqual({ status: "unavailable" });
		});

		it("is unavailable when only the dev server answers", async () => {
			server.on("GET", "/api/me", new Response("", { status: 502 }));

			await expect(session.refresh()).resolves.toEqual({ status: "unavailable" });
		});
	});

	describe("login and logout", () => {
		it("logs in through the backend and returns to a local path", () => {
			expect(session.loginUrl("/editor?x=1")).toBe("/auth/login?returnUrl=%2Feditor%3Fx%3D1");
			expect(session.loginUrl()).toBe("/auth/login?returnUrl=%2F");
		});

		it("never returns to another origin", () => {
			expect(session.loginUrl("https://evil.example.org")).toBe("/auth/login?returnUrl=%2F");
			expect(session.loginUrl("//evil.example.org")).toBe("/auth/login?returnUrl=%2F");
			expect(session.loginUrl("/\\evil.example.org")).toBe("/auth/login?returnUrl=%2F");
		});

		it("knows when the last login failed", () => {
			expect(AuthSession.loginNotice("?login=failed")).toBe("failed");
			expect(AuthSession.loginNotice("?login=blocked")).toBe("blocked");
			expect(AuthSession.loginNotice("?login=other")).toBeNull();
			expect(AuthSession.loginNotice("")).toBeNull();
		});

		it("provides the antiforgery field for the logout form", async () => {
			await expect(session.logoutField()).resolves.toEqual({ name: "__RequestVerificationToken", value: "token-1" });
			expect(AuthSession.LOGOUT_PATH).toBe("/auth/logout");
		});
	});

	describe("changeDisplayName", () => {
		beforeEach(async () => {
			server.on("GET", "/api/me", jsonResponse(200, ALICE));
			await session.refresh();
		});

		it("saves the name and updates the state", async () => {
			server.on("PUT", "/api/me/display-name", jsonResponse(200, { ...ALICE, displayName: "Coach" }));

			const result = await session.changeDisplayName("Coach");

			expect(result).toEqual({ ok: true, user: { ...ALICE, displayName: "Coach" } });
			expect(get(session.state)).toEqual({ status: "authenticated", user: { ...ALICE, displayName: "Coach" } });
			const [request] = server.requestsTo("/api/me/display-name");
			expect(JSON.parse(request.body!)).toEqual({ displayName: "Coach" });
			expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
		});

		it("words the server's validation code in the UI language", async () => {
			server.on(
				"PUT",
				"/api/me/display-name",
				problemResponse(400, {
					type: "https://tacticalboard/errors/validation-failed",
					errors: { displayName: ["The display name must be at most 100 characters long."] },
					fieldErrors: { displayName: [{ code: "too-long", maxLength: 100 }] },
				}),
			);

			const result = await session.changeDisplayName("x".repeat(101));

			expect(inEnglishDeep(result)).toEqual({ ok: false, message: "The display name must be at most 100 characters long." });
			expect(translateDeep(result, de)).toEqual({ ok: false, message: "Der Anzeigename darf höchstens 100 Zeichen lang sein." });
		});

		it("words an empty name from its code, never the server's English text", async () => {
			server.on(
				"PUT",
				"/api/me/display-name",
				problemResponse(400, {
					type: "https://tacticalboard/errors/validation-failed",
					errors: { displayName: ["Server text."] },
					fieldErrors: { displayName: [{ code: "required" }] },
				}),
			);

			const result = await session.changeDisplayName(" ");

			expect(inEnglishDeep(result)).toEqual({ ok: false, message: "The display name must not be empty." });
			expect(get(session.state)).toEqual({ status: "authenticated", user: ALICE });
		});

		it("falls back to a generic message for other errors", async () => {
			server.on("PUT", "/api/me/display-name", problemResponse(500, {}));

			expect(inEnglishDeep(await session.changeDisplayName("Coach"))).toEqual({ ok: false, message: "The display name couldn't be saved." });
		});

		it("falls back to the generic message for a validation problem without codes", async () => {
			server.on(
				"PUT",
				"/api/me/display-name",
				problemResponse(400, { type: "https://tacticalboard/errors/validation-failed", errors: { displayName: ["English only."] } }),
			);

			expect(inEnglishDeep(await session.changeDisplayName("Coach"))).toEqual({ ok: false, message: "Some of the data is invalid." });
		});

		it("becomes anonymous when the session has ended", async () => {
			server.on("PUT", "/api/me/display-name", problemResponse(401, {}));

			const result = await session.changeDisplayName("Coach");

			expect(inEnglishDeep(result)).toEqual({ ok: false, message: "Your session has ended. Please log in again." });
			expect(get(session.state)).toEqual({ status: "anonymous" });
		});

		it("reports an unreachable server", async () => {
			server.failOn("PUT", "/api/me/display-name");

			expect(inEnglishDeep(await session.changeDisplayName("Coach"))).toEqual({
				ok: false,
				message: "The server is not reachable. Please try again later.",
			});
		});
	});

	describe("changeLanguage", () => {
		beforeEach(async () => {
			server.on("GET", "/api/me", jsonResponse(200, ALICE));
			await session.refresh();
		});

		it("stores the language in the account and carries it in the state", async () => {
			server.on("PUT", "/api/me/language", jsonResponse(200, { ...ALICE, preferredLanguage: "de" }));

			await expect(session.changeLanguage("de")).resolves.toBe(true);

			expect(get(session.state)).toEqual({ status: "authenticated", user: { ...ALICE, preferredLanguage: "de" } });
			const [request] = server.requestsTo("/api/me/language");
			expect(request.method).toBe("PUT");
			expect(JSON.parse(request.body!)).toEqual({ language: "de" });
			expect(request.headers["X-CSRF-TOKEN"]).toBe("token-1");
		});

		it("reports a failure without changing the state", async () => {
			server.on("PUT", "/api/me/language", problemResponse(500, {}));

			await expect(session.changeLanguage("de")).resolves.toBe(false);
			expect(get(session.state)).toEqual({ status: "authenticated", user: ALICE });
		});

		it("reports no server without changing the state", async () => {
			server.failOn("PUT", "/api/me/language");

			await expect(session.changeLanguage("de")).resolves.toBe(false);
			expect(get(session.state)).toEqual({ status: "authenticated", user: ALICE });
		});

		it("becomes anonymous when the session has ended", async () => {
			server.on("PUT", "/api/me/language", problemResponse(401, {}));

			await expect(session.changeLanguage("de")).resolves.toBe(false);
			expect(get(session.state)).toEqual({ status: "anonymous" });
		});
	});

	it("exports app-wide instances", () => {
		expect(authSession).toBeInstanceOf(AuthSession);
		expect(apiClient).toBeInstanceOf(ApiClient);
	});
});
