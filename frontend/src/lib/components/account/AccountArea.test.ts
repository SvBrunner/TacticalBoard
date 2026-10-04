import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { i18n } from "$lib/i18n";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import { tick } from "svelte";
import { ApiClient } from "$lib/api/ApiClient";
import { AuthSession } from "$lib/auth/AuthSession";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import AccountArea from "./AccountArea.svelte";

const ALICE = { id: "1", displayName: "Alice", isSystemAdministrator: false, preferredLanguage: null };

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("AccountArea", () => {
	let server: FakeFetch;
	let session: AuthSession;
	let restore: () => void;

	beforeEach(() => {
		restore = installDialogPolyfill();
		server = new FakeFetch().on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY));
		session = new AuthSession(new ApiClient(server.fetch));
	});

	afterEach(() => {
		cleanup();
		restore();
	});

	it("shows nothing while the session is unknown", () => {
		const { container } = render(AccountArea, { props: { session } });

		expect(container.querySelector(".account-area")).toBeEmptyDOMElement();
	});

	describe("anonymous", () => {
		beforeEach(async () => {
			server.on("GET", "/api/me", problemResponse(401, {}));
			await session.refresh();
		});

		it("offers a Log in link to the backend that returns to the page", () => {
			render(AccountArea, { props: { session, returnTo: "/" } });

			const link = screen.getByRole("link", { name: "Log in" });
			expect(link).toHaveAttribute("href", "/auth/login?returnUrl=%2F");
			// A full page load, not a client-side route.
			expect(link).toHaveAttribute("data-sveltekit-reload");
		});

		it("says when the last login failed", () => {
			render(AccountArea, { props: { session, loginNotice: "failed" } });

			expect(screen.getByRole("status")).toHaveTextContent("Login failed.");
			expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
		});

		it("says when the account is blocked", () => {
			render(AccountArea, { props: { session, loginNotice: "blocked" } });

			expect(screen.getByRole("status")).toHaveTextContent("Account blocked.");
		});

		it("says nothing about a login by default", () => {
			render(AccountArea, { props: { session } });

			expect(screen.queryByRole("status")).toBeNull();
		});
	});

	it("shows only a quiet local-mode note without a backend", async () => {
		server.failOn("GET", "/api/me");
		await session.refresh();

		render(AccountArea, { props: { session } });

		expect(screen.getByText("Local mode")).toBeInTheDocument();
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	describe("logged in", () => {
		beforeEach(async () => {
			server.on("GET", "/api/me", jsonResponse(200, ALICE));
			await session.refresh();
		});

		it("shows the user's menu instead of Log in", () => {
			render(AccountArea, { props: { session } });

			expect(screen.getByRole("button", { name: "Alice" })).toBeInTheDocument();
			expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
		});

		it("changes the display name through the dialog", async () => {
			server.on("PUT", "/api/me/display-name", jsonResponse(200, { ...ALICE, displayName: "Coach" }));
			render(AccountArea, { props: { session } });

			await fireEvent.click(screen.getByRole("button", { name: "Alice" }));
			await fireEvent.click(screen.getByRole("button", { name: "Change display name" }));
			const dialog = screen.getByRole("dialog", { name: "Change display name" });
			expect(dialog).toHaveAttribute("open");
			await fireEvent.input(screen.getByRole("textbox", { name: "Display name" }), { target: { value: "Coach" } });
			await fireEvent.click(screen.getByRole("button", { name: "Save" }));
			await settle();

			expect(dialog).not.toHaveAttribute("open");
			expect(screen.getByRole("button", { name: "Coach" })).toBeInTheDocument();
		});

		it("logs out with the antiforgery field", async () => {
			const submitForm = vi.fn();
			render(AccountArea, { props: { session, submitForm } });

			await fireEvent.submit(screen.getByRole("button", { name: "Log out", hidden: true }).closest("form")!);
			await settle();

			const form = submitForm.mock.calls[0][0] as HTMLFormElement;
			expect(form.querySelector<HTMLInputElement>("input[type=hidden]")!.value).toBe("token-1");
		});
	});

	it("is German in German", async () => {
		server.on("GET", "/api/me", problemResponse(401, {}));
		await session.refresh();
		i18n.select("de");
		render(AccountArea, { props: { session, loginNotice: "blocked" } });

		expect(screen.getByRole("link", { name: "Anmelden" })).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("Konto gesperrt.");
	});
});
