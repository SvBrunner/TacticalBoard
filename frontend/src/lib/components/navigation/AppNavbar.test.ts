import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { authSession } from "$lib/auth/AuthSession";
import { FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import AppNavbar from "./AppNavbar.svelte";

async function sessionFrom(response: Response) {
	vi.stubGlobal("fetch", new FakeFetch().on("GET", "/api/me", response).fetch);
	await authSession.refresh();
}

describe("AppNavbar", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("is the banner with the title as h1 and a Main navigation linking to the start page", () => {
		render(AppNavbar, { props: { title: "Powerplay" } });

		const banner = screen.getByRole("banner");
		expect(within(banner).getByRole("heading", { level: 1, name: "Powerplay" })).toBeInTheDocument();
		const main = within(banner).getByRole("navigation", { name: "Main" });
		const link = within(main).getByRole("link", { name: "Start page" });
		expect(link).toHaveAttribute("href", "/");
		expect(link).not.toHaveAttribute("aria-current");
	});

	it("marks the start page as the current page", () => {
		render(AppNavbar, { props: { title: "Tactical Board", home: true } });

		expect(screen.getByRole("link", { name: "Start page" })).toHaveAttribute("aria-current", "page");
	});

	it("a plain click on the badge goes through onHome; a modified click is left to the browser", async () => {
		const onHome = vi.fn();
		render(AppNavbar, { props: { title: "X", onHome } });
		const link = screen.getByRole("link", { name: "Start page" });

		const followedPlain = await fireEvent.click(link);
		const followedModified = await fireEvent.click(link, { ctrlKey: true });

		expect(followedPlain).toBe(false);
		expect(followedModified).toBe(true);
		expect(onHome).toHaveBeenCalledOnce();
	});

	it("without onHome the badge is an ordinary link", async () => {
		render(AppNavbar, { props: { title: "X" } });

		expect(await fireEvent.click(screen.getByRole("link", { name: "Start page" }))).toBe(true);
	});

	it("has the account corner: Log in returning to the given page", async () => {
		await sessionFrom(problemResponse(401, {}));
		render(AppNavbar, { props: { title: "X", loginReturnTo: "/editor?situation=s1" } });

		const account = screen.getByRole("navigation", { name: "Account" });
		expect(within(account).getByRole("link", { name: "Log in" })).toHaveAttribute(
			"href",
			"/auth/login?returnUrl=%2Feditor%3Fsituation%3Ds1",
		);
	});

	it("shows the user's menu when logged in", async () => {
		await sessionFrom(jsonResponse(200, { id: "1", displayName: "Alice", isSystemAdministrator: false }));
		render(AppNavbar, { props: { title: "X" } });

		expect(within(screen.getByRole("navigation", { name: "Account" })).getByRole("button", { name: "Alice" })).toBeInTheDocument();
	});

	it("passes the login notice on", async () => {
		await sessionFrom(problemResponse(401, {}));
		render(AppNavbar, { props: { title: "X", loginNotice: "blocked" } });

		expect(screen.getByRole("status")).toHaveTextContent("Account blocked.");
	});
});

describe("AppNavbar with actions and status", () => {
	afterEach(() => cleanup());

	it("renders the page's actions and the status inside the banner", async () => {
		const { default: Wrapper } = await import("./AppNavbarWithSnippets.test.svelte");
		render(Wrapper);

		const banner = screen.getByRole("banner");
		expect(within(banner).getByRole("button", { name: "Tool" })).toBeInTheDocument();
		expect(within(banner).getByRole("alert")).toHaveTextContent("Problem");
	});
});
