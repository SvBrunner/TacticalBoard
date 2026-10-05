import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { authSession } from "$lib/auth/AuthSession";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import type { Team } from "$lib/teams/TeamApi";
import TeamRoutePage from "./+page.svelte";
import { load } from "./+page";

const alice = {
	id: "u1",
	displayName: "Alice",
	isSystemAdministrator: false,
	preferredLanguage: null,
};
const lions: Team = {
	id: "t1",
	code: "ABC123",
	name: "Lions",
	logoUrl: null,
	createdAt: "2026-10-04T08:00:00Z",
	role: "admin",
};

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

describe("team route", () => {
	it("hands the code from the URL to the page", () => {
		expect(load({ params: { code: "ABC123" } } as unknown as Parameters<typeof load>[0])).toEqual({ code: "ABC123" });
	});
});

describe("team page", () => {
	let restore: () => void;
	let server: FakeFetch;

	beforeEach(() => {
		restore = installDialogPolyfill();
	});

	afterEach(() => {
		cleanup();
		restore();
		vi.unstubAllGlobals();
	});

	async function renderTeam(team: Team | null = lions, me: Response = jsonResponse(200, alice)) {
		server = new FakeFetch()
			.on("GET", "/api/me", me)
			.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY))
			.on(
				"GET",
				"/api/teams/ABC123",
				team
					? jsonResponse(200, team)
					: problemResponse(404, {
							type: "https://tacticalboard/errors/team-not-found",
						}),
			);
		vi.stubGlobal("fetch", server.fetch);
		await authSession.refresh();
		const view = render(TeamRoutePage, { props: { data: { code: "ABC123" } } });
		await settle();
		return view;
	}

	const teamSection = () => screen.getByRole("region", { name: "Team" });

	it("has the navbar with the team's name as h1 and a breadcrumb through the overview", async () => {
		await renderTeam();

		expect(
			within(screen.getByRole("banner")).getByRole("heading", {
				level: 1,
				name: "Lions",
			}),
		).toBeInTheDocument();
		const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
		expect(
			within(breadcrumb)
				.getAllByRole("link")
				.map((link) => link.getAttribute("href")),
		).toEqual(["/", "/teams"]);
		expect(within(breadcrumb).getByText("Lions")).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("main")).toBeInTheDocument();
	});

	it("shows the name, the code, the link to share and the member's role", async () => {
		await renderTeam({ ...lions, role: "reader" });

		const section = teamSection();
		expect(section).toHaveTextContent("Lions");
		const facts = within(section)
			.getAllByRole("term")
			.map((term) => term.textContent);
		expect(facts).toEqual(["Code", "Link", "Your role"]);
		expect(
			within(section)
				.getAllByRole("definition")
				.map((value) => value.textContent),
		).toEqual(["ABC123", `${window.location.origin}/teams/ABC123`, "Reader"]);
		expect(within(section).queryByRole("button", { name: "Rename" })).toBeNull();
		expect(screen.queryByRole("region", { name: "Logo" })).toBeNull();
	});

	it("shows the logo with a text alternative", async () => {
		await renderTeam({
			...lions,
			logoUrl: "/api/teams/ABC123/logo?v=1",
			role: null,
		});

		expect(within(teamSection()).getByRole("img", { name: "Logo of Lions" })).toHaveAttribute("src", "/api/teams/ABC123/logo?v=1");
	});

	it("shows non-members the public data and that joining isn't possible yet, without a fake button", async () => {
		await renderTeam({ ...lions, role: null });

		const section = teamSection();
		expect(section).toHaveTextContent("You're not a member of this team. Asking to join a team isn't possible yet.");
		expect(
			within(section)
				.getAllByRole("term")
				.map((term) => term.textContent),
		).toEqual(["Code", "Link"]);
		expect(within(section).queryAllByRole("button")).toEqual([]);
	});

	it("lets an Admin rename the team", async () => {
		await renderTeam();
		server.on("PUT", "/api/teams/ABC123", jsonResponse(200, { ...lions, name: "Tigers" }));

		await fireEvent.click(within(teamSection()).getByRole("button", { name: "Rename" }));
		const dialog = screen.getByRole("dialog", { name: "Rename team" });
		await fireEvent.input(within(dialog).getByRole("textbox", { name: "Team name" }), { target: { value: "Tigers" } });
		await fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));
		await settle();

		expect(within(screen.getByRole("banner")).getByRole("heading", { level: 1 })).toHaveTextContent("Tigers");
		expect(JSON.parse(server.requestsTo("/api/teams/ABC123").find((request) => request.method === "PUT")!.body!)).toEqual({ name: "Tigers" });
	});

	it("lets an Admin upload a logo", async () => {
		const { container } = await renderTeam();
		server.on("PUT", "/api/teams/ABC123/logo", jsonResponse(200, { ...lions, logoUrl: "/api/teams/ABC123/logo?v=2" }));
		const logoSection = screen.getByRole("region", { name: "Logo" });
		expect(logoSection).toHaveTextContent("No logo.");

		const input = container.querySelector<HTMLInputElement>("input[type=file]")!;
		Object.defineProperty(input, "files", {
			value: [new File([new Uint8Array(1)], "logo.png", { type: "image/png" })],
			configurable: true,
		});
		await fireEvent.change(input);
		await settle();

		expect(within(teamSection()).getByRole("img", { name: "Logo of Lions" })).toHaveAttribute("src", "/api/teams/ABC123/logo?v=2");
		expect(within(screen.getByRole("region", { name: "Logo" })).getByRole("status")).toHaveTextContent("Logo saved.");
	});

	it("asks before an Admin removes the logo", async () => {
		await renderTeam({ ...lions, logoUrl: "/api/teams/ABC123/logo?v=1" });
		server.on("DELETE", "/api/teams/ABC123/logo", new Response(null, { status: 204 }));

		await fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
		await settle();
		const question = screen.getByRole("alertdialog", { name: "Remove logo?" });
		expect(question).toHaveTextContent("The logo of “Lions” will be removed.");
		await fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
		await settle();
		expect(server.requestsTo("/api/teams/ABC123/logo")).toHaveLength(0);

		await fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove logo?" })).getByRole("button", { name: "Remove" }));
		await settle();

		expect(server.requestsTo("/api/teams/ABC123/logo")).toHaveLength(1);
		expect(within(teamSection()).queryByRole("img")).toBeNull();
		expect(screen.getByRole("region", { name: "Logo" })).toHaveTextContent("No logo.");
	});

	it("says when the team doesn't exist", async () => {
		await renderTeam(null);

		expect(screen.getByRole("main")).toHaveTextContent("This team doesn't exist (any more).");
		expect(screen.getByRole("link", { name: "Back to the teams" })).toHaveAttribute("href", "/teams");
	});

	it("offers to try again after a failure", async () => {
		server = new FakeFetch();
		await renderTeam(lions);
		cleanup();
		server.on("GET", "/api/teams/ABC123", problemResponse(500, {}));
		render(TeamRoutePage, { props: { data: { code: "ABC123" } } });
		await settle();

		expect(screen.getByRole("alert")).toHaveTextContent("The team couldn't be loaded.");
		server.on("GET", "/api/teams/ABC123", jsonResponse(200, lions));
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		await settle();
		expect(teamSection()).toBeInTheDocument();
	});

	it("asks to log in when logged out, returning to the team's page", async () => {
		await renderTeam(lions, problemResponse(401, {}));

		expect(screen.getByRole("main")).toHaveTextContent("Log in to see this team.");
		expect(within(screen.getByRole("banner")).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/auth/login?returnUrl=%2Fteams%2FABC123");
	});
});
