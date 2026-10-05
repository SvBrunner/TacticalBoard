import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { authSession } from "$lib/auth/AuthSession";
import { FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import type { TeamSummary } from "$lib/teams/TeamApi";
import TeamsPage from "./+page.svelte";

const alice = {
	id: "u1",
	displayName: "Alice",
	isSystemAdministrator: false,
	preferredLanguage: null,
};

function teamOf(index: number): TeamSummary {
	return {
		id: `t${index}`,
		code: `AAAA${String(index).padStart(2, "0")}`,
		name: `Team ${index}`,
		logoUrl: index === 1 ? "/api/teams/AAAA01/logo?v=1" : null,
	};
}

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("team overview page", () => {
	let server: FakeFetch;

	beforeEach(() => {
		server = new FakeFetch().on("GET", "/api/me", jsonResponse(200, alice));
		vi.stubGlobal("fetch", server.fetch);
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	function answer(query: string, items: TeamSummary[], total = items.length, offset = 0) {
		server.on("GET", `/api/teams?${query}`, jsonResponse(200, { items, total, offset, limit: 50 }));
	}

	async function renderPage() {
		await authSession.refresh();
		const view = render(TeamsPage);
		await settle();
		return view;
	}

	it("has the navbar with Teams as h1, a breadcrumb, a search landmark and the main landmark", async () => {
		answer("offset=0&limit=50", [teamOf(1)]);
		await renderPage();

		expect(
			within(screen.getByRole("banner")).getByRole("heading", {
				level: 1,
				name: "Teams",
			}),
		).toBeInTheDocument();
		const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
		expect(within(breadcrumb).getByRole("link", { name: "Start page" })).toHaveAttribute("href", "/");
		expect(within(breadcrumb).getByText("Teams")).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("search")).toBeInTheDocument();
		expect(screen.getByRole("searchbox", { name: "Name or code" })).toBeInTheDocument();
		expect(screen.getByRole("main")).toBeInTheDocument();
	});

	it("lists all teams with their logos and codes, linking to their pages", async () => {
		answer("offset=0&limit=50", [teamOf(1), teamOf(2)]);
		await renderPage();

		const results = screen.getByRole("region", { name: "Teams" });
		expect(within(results).getByRole("status")).toHaveTextContent("2 teams");
		const links = within(results).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["/teams/AAAA01", "/teams/AAAA02"]);
		expect(links[0].querySelector("img")).toHaveAttribute("src", "/api/teams/AAAA01/logo?v=1");
		expect(links[1]).toHaveTextContent("Code AAAA02");
	});

	it("searches by name or code with the Search button", async () => {
		answer("offset=0&limit=50", [teamOf(1), teamOf(2)]);
		answer("search=aaaa02&offset=0&limit=50", [teamOf(2)]);
		await renderPage();

		await fireEvent.input(screen.getByRole("searchbox"), {
			target: { value: "aaaa02" },
		});
		await fireEvent.click(screen.getByRole("button", { name: "Search" }));
		await settle();

		expect(
			within(screen.getByRole("region", { name: "Teams" }))
				.getAllByRole("link")
				.map((link) => link.textContent),
		).toEqual([expect.stringContaining("Team 2")]);
	});

	it("searches while typing after a pause", async () => {
		answer("offset=0&limit=50", [teamOf(1), teamOf(2)]);
		answer("search=Team+1&offset=0&limit=50", [teamOf(1)]);
		await renderPage();
		vi.useFakeTimers();

		await fireEvent.input(screen.getByRole("searchbox"), {
			target: { value: "Team 1" },
		});
		expect(server.requestsTo("/api/teams?search=Team+1&offset=0&limit=50")).toHaveLength(0);
		await vi.advanceTimersByTimeAsync(300);
		vi.useRealTimers();
		await settle();

		expect(server.requestsTo("/api/teams?search=Team+1&offset=0&limit=50")).toHaveLength(1);
		expect(within(screen.getByRole("region", { name: "Teams" })).getAllByRole("link")).toHaveLength(1);
	});

	it("says when no team matches, and when there are no teams at all", async () => {
		answer("offset=0&limit=50", []);
		answer("search=zzz&offset=0&limit=50", []);
		await renderPage();
		expect(screen.getByRole("region", { name: "Teams" })).toHaveTextContent("There are no teams yet.");

		await fireEvent.input(screen.getByRole("searchbox"), {
			target: { value: "zzz" },
		});
		await fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
		await settle();

		expect(screen.getByRole("region", { name: "Teams" })).toHaveTextContent("No team matches “zzz”.");
	});

	it("shows more teams page by page", async () => {
		answer("offset=0&limit=50", [teamOf(1)], 2);
		server.on("GET", "/api/teams?offset=1&limit=50", jsonResponse(200, { items: [teamOf(2)], total: 2, offset: 1, limit: 50 }));
		await renderPage();

		await fireEvent.click(screen.getByRole("button", { name: "Show more" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Teams" })).getAllByRole("link")).toHaveLength(2);
		expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
	});

	it("offers to try again after a failure", async () => {
		server.on("GET", "/api/teams?offset=0&limit=50", problemResponse(500, {}));
		await renderPage();

		expect(screen.getByRole("alert")).toHaveTextContent("The teams couldn't be loaded.");
		answer("offset=0&limit=50", [teamOf(1)]);
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		await settle();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("asks to log in when logged out, and explains a missing server", async () => {
		server.on("GET", "/api/me", problemResponse(401, {}));
		await renderPage();
		expect(screen.getByRole("main")).toHaveTextContent("Log in to see the teams.");
		expect(screen.queryByRole("search")).toBeNull();
		cleanup();

		server.failOn("GET", "/api/me");
		await renderPage();
		expect(screen.getByRole("main")).toHaveTextContent("Teams need the server, which can't be reached.");
	});
});
