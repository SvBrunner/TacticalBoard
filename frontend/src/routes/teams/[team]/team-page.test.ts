import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent, within } from "@testing-library/svelte";
import { tick } from "svelte";
import { authSession } from "$lib/auth/AuthSession";
import { installDialogPolyfill } from "$lib/testing/dialogPolyfill";
import { ANTIFORGERY, FakeFetch, jsonResponse, problemResponse } from "$lib/testing/fakeFetch";
import type { JoinRequest, Team, TeamMember } from "$lib/teams/TeamApi";
import { goto } from "$app/navigation";
import TeamRoutePage from "./+page.svelte";
import { load } from "./+page";

const alice = {
	id: "u1",
	displayName: "Alice",
	isSystemAdministrator: false,
	preferredLanguage: null,
};
const aliceMember: TeamMember = { userId: "u1", displayName: "Alice", role: "admin", joinedAt: "2026-10-04T08:00:00Z" };
const bobMember: TeamMember = { userId: "u2", displayName: "Bob", role: "reader", joinedAt: "2026-10-05T08:00:00Z" };
const carolRequest: JoinRequest = { id: "r1", user: { id: "u3", displayName: "Carol" }, requestedAt: "2026-10-05T09:00:00Z" };
const stranger = (team: Team): Team => ({ ...team, code: null, role: null, pendingJoinRequests: null });
const lions: Team = {
	id: "t1",
	code: "ABC123",
	name: "Lions",
	logoUrl: null,
	createdAt: "2026-10-04T08:00:00Z",
	role: "admin",
	joinRequestPending: false,
	pendingJoinRequests: 0,
};

async function settle() {
	for (let i = 0; i < 10; i++) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	await tick();
}

vi.mock("$app/navigation", () => ({ goto: vi.fn() }));

describe("team route", () => {
	it("hands the code (or id) from the URL to the page", () => {
		expect(load({ params: { team: "ABC123" } } as unknown as Parameters<typeof load>[0])).toEqual({ team: "ABC123" });
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
		vi.mocked(goto).mockClear();
	});

	async function renderTeam(
		team: Team | null = lions,
		me: Response = jsonResponse(200, alice),
		members: TeamMember[] = [aliceMember, bobMember],
		requests: JoinRequest[] = [],
	) {
		server = new FakeFetch()
			.on("GET", "/api/me", me)
			.on("GET", "/api/antiforgery", jsonResponse(200, ANTIFORGERY))
			.on("GET", "/api/teams/ABC123/members", jsonResponse(200, members))
			.on("GET", "/api/teams/ABC123/join-requests", jsonResponse(200, requests))
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
		const view = render(TeamRoutePage, { props: { data: { team: "ABC123" } } });
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

	it("shows non-members only the name and the logo, and lets them ask to join", async () => {
		await renderTeam(stranger(lions));
		server.on("POST", "/api/teams/ABC123/join-requests", jsonResponse(201, carolRequest));

		const section = teamSection();
		expect(section).toHaveTextContent("Lions");
		expect(section).toHaveTextContent("You're not a member of this team.");
		expect(within(section).queryAllByRole("term")).toEqual([]);
		expect(section).not.toHaveTextContent("ABC123");
		expect(screen.queryByRole("region", { name: "Members" })).toBeNull();
		expect(server.requestsTo("/api/teams/ABC123/members")).toHaveLength(0);

		server.on("GET", "/api/teams/ABC123", jsonResponse(200, { ...stranger(lions), joinRequestPending: true }));
		await fireEvent.click(within(section).getByRole("button", { name: "Ask to join" }));
		await settle();

		expect(server.requestsTo("/api/teams/ABC123/join-requests").map((request) => request.method)).toEqual(["POST"]);
		expect(teamSection()).toHaveTextContent("You've asked to join this team. An Admin will accept or reject your request.");
		expect(within(teamSection()).queryByRole("button", { name: "Ask to join" })).toBeNull();
	});

	it("shows a pending request instead of the button", async () => {
		await renderTeam({ ...stranger(lions), joinRequestPending: true });

		expect(within(teamSection()).getAllByRole("status")[0]).toHaveTextContent("You've asked to join this team.");
		expect(within(teamSection()).queryAllByRole("button")).toEqual([]);
	});

	it("says why a request to join failed", async () => {
		await renderTeam(stranger(lions));
		server.on("POST", "/api/teams/ABC123/join-requests", problemResponse(500, {}));

		await fireEvent.click(screen.getByRole("button", { name: "Ask to join" }));
		await settle();

		expect(within(teamSection()).getByRole("alert")).toHaveTextContent("Your request couldn't be sent.");
	});

	it("shows every member the member list, Readers without management", async () => {
		await renderTeam({ ...lions, role: "reader" }, jsonResponse(200, { ...alice, id: "u2" }));

		const members = screen.getByRole("region", { name: "Members" });
		expect(members).toHaveTextContent("2 members");
		const items = within(within(members).getByRole("list", { name: "Members" })).getAllByRole("listitem");
		expect(items.map((item) => item.textContent?.replace(/\s+/g, " ").trim())).toEqual(["Alice Admin", "Bob (you) Reader"]);
		expect(within(members).queryByRole("combobox")).toBeNull();
		expect(within(members).queryByRole("button", { name: /Remove/ })).toBeNull();
		expect(screen.queryByRole("region", { name: /Join requests/ })).toBeNull();
		expect(screen.queryByRole("region", { name: "Delete team" })).toBeNull();
		expect(within(members).getByRole("button", { name: "Leave team" })).toBeInTheDocument();
	});

	it("lets an Admin change a member's role", async () => {
		await renderTeam();
		server.on("PUT", "/api/teams/ABC123/members/u2/role", jsonResponse(200, { ...bobMember, role: "editor" }));
		const members = screen.getByRole("region", { name: "Members" });

		const picker = within(members).getByRole("combobox", { name: "Role of Bob" });
		await fireEvent.change(picker, { target: { value: "editor" } });
		await settle();

		expect(JSON.parse(server.requestsTo("/api/teams/ABC123/members/u2/role")[0].body!)).toEqual({ role: "editor" });
		expect(within(members).getByRole("combobox", { name: "Role of Bob" })).toHaveValue("editor");
		expect(within(members).getByRole("status")).toHaveTextContent("Bob is now Editor.");
	});

	it("tells the last Admin why their role can't change", async () => {
		await renderTeam();
		server.on("PUT", "/api/teams/ABC123/members/u1/role", problemResponse(409, { type: "https://tacticalboard/errors/last-team-admin" }));
		const members = screen.getByRole("region", { name: "Members" });

		await fireEvent.change(within(members).getByRole("combobox", { name: "Role of Alice (you)" }), { target: { value: "reader" } });
		await settle();

		expect(within(members).getByRole("alert")).toHaveTextContent("“Lions” needs at least one Admin. Make another member Admin first.");
		expect(within(members).getByRole("combobox", { name: "Role of Alice (you)" })).toHaveValue("admin");
	});

	it("reloads the team after an Admin changed their own role", async () => {
		await renderTeam(lions, jsonResponse(200, alice), [aliceMember, { ...bobMember, role: "admin" }]);
		server.on("PUT", "/api/teams/ABC123/members/u1/role", jsonResponse(200, { ...aliceMember, role: "reader" }));
		server.on("GET", "/api/teams/ABC123", jsonResponse(200, { ...lions, role: "reader", pendingJoinRequests: null }));

		await fireEvent.change(screen.getByRole("combobox", { name: "Role of Alice (you)" }), { target: { value: "reader" } });
		await settle();

		expect(within(screen.getByRole("main")).queryByRole("combobox")).toBeNull();
		expect(screen.queryByRole("region", { name: "Delete team" })).toBeNull();
		expect(within(teamSection()).getAllByRole("definition").at(-1)).toHaveTextContent("Reader");
	});

	it("asks before an Admin removes a member", async () => {
		await renderTeam();
		server.on("DELETE", "/api/teams/ABC123/members/u2", new Response(null, { status: 204 }));

		await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
		await settle();
		const question = screen.getByRole("alertdialog", { name: "Remove member?" });
		expect(question).toHaveTextContent("Bob will be removed from “Lions” and lose access to it at once.");
		await fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
		await settle();
		expect(server.requestsTo("/api/teams/ABC123/members/u2")).toHaveLength(0);

		await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove member?" })).getByRole("button", { name: "Remove" }));
		await settle();

		expect(server.requestsTo("/api/teams/ABC123/members/u2")).toHaveLength(1);
		const members = screen.getByRole("region", { name: "Members" });
		expect(members).not.toHaveTextContent("Bob (");
		expect(within(members).getByRole("status")).toHaveTextContent("Bob was removed from the team.");
	});

	it("shows the public view when the user lost their rights meanwhile", async () => {
		await renderTeam();
		server.on("DELETE", "/api/teams/ABC123/members/u2", problemResponse(403, { type: "https://tacticalboard/errors/forbidden" }));
		server.on("GET", "/api/teams/ABC123", jsonResponse(200, stranger(lions)));

		await fireEvent.click(screen.getByRole("button", { name: "Remove Bob" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Remove member?" })).getByRole("button", { name: "Remove" }));
		await settle();

		expect(screen.queryByRole("region", { name: "Members" })).toBeNull();
		expect(teamSection()).toHaveTextContent("You're not a member of this team.");
	});

	it("shows Admins the join requests with their count and lets them accept and reject", async () => {
		const daveRequest: JoinRequest = { id: "r2", user: { id: "u4", displayName: null }, requestedAt: "2026-10-05T10:00:00Z" };
		await renderTeam({ ...lions, pendingJoinRequests: 2 }, jsonResponse(200, alice), [aliceMember], [carolRequest, daveRequest]);
		server.on("POST", "/api/teams/ABC123/join-requests/r1/accept", jsonResponse(200, { userId: "u3", displayName: "Carol", role: "reader", joinedAt: "2026-10-05T11:00:00Z" }));
		server.on("POST", "/api/teams/ABC123/join-requests/r2/reject", new Response(null, { status: 204 }));

		const requests = screen.getByRole("region", { name: /Join requests/ });
		expect(requests).toHaveTextContent("2 join requests");
		expect(within(requests).getAllByRole("listitem").map((item) => item.querySelector(".name")?.textContent)).toEqual(["Carol", "Deleted user"]);
		expect(within(requests).getAllByRole("listitem")[0]).toHaveTextContent("Asked Oct 5, 2026");
		expect(within(requests).getAllByRole("listitem")[0].querySelector("time")).toHaveAttribute("datetime", carolRequest.requestedAt);

		server.on("GET", "/api/teams/ABC123/members", jsonResponse(200, [aliceMember, { userId: "u3", displayName: "Carol", role: "reader", joinedAt: "2026-10-05T11:00:00Z" }]));
		server.on("GET", "/api/teams/ABC123", jsonResponse(200, { ...lions, pendingJoinRequests: 1 }));
		await fireEvent.click(within(requests).getByRole("button", { name: "Accept Carol" }));
		await settle();

		expect(within(screen.getByRole("region", { name: /Join requests/ })).getByRole("status")).toHaveTextContent("Carol is now a member (Reader).");
		expect(screen.getByRole("region", { name: "Members" })).toHaveTextContent("Carol");
		expect(screen.getByRole("region", { name: /Join requests/ })).toHaveTextContent("1 join request");

		await fireEvent.click(screen.getByRole("button", { name: "Reject Deleted user" }));
		await settle();
		expect(server.requestsTo("/api/teams/ABC123/join-requests/r2/reject")).toHaveLength(1);
		expect(screen.getByRole("region", { name: /Join requests/ })).toHaveTextContent("No one is waiting to join.");
	});

	it("says when another Admin decided a request meanwhile", async () => {
		await renderTeam(lions, jsonResponse(200, alice), [aliceMember], [carolRequest]);
		server.on("POST", "/api/teams/ABC123/join-requests/r1/reject", problemResponse(404, { type: "https://tacticalboard/errors/join-request-not-found" }));
		server.on("GET", "/api/teams/ABC123/join-requests", jsonResponse(200, []));

		await fireEvent.click(screen.getByRole("button", { name: "Reject Carol" }));
		await settle();

		const requests = screen.getByRole("region", { name: /Join requests/ });
		expect(within(requests).getByRole("alert")).toHaveTextContent("This request was already decided or no longer exists.");
		expect(within(requests).queryByRole("listitem")).toBeNull();
	});

	it("asks before a member leaves, then shows the public view", async () => {
		await renderTeam({ ...lions, role: "editor", pendingJoinRequests: null }, jsonResponse(200, { ...alice, id: "u2" }));
		server.on("DELETE", "/api/teams/ABC123/members/me", new Response(null, { status: 204 }));

		await fireEvent.click(screen.getByRole("button", { name: "Leave team" }));
		await settle();
		const question = screen.getByRole("alertdialog", { name: "Leave team?" });
		expect(question).toHaveTextContent("You'll leave “Lions” and lose access to it at once.");
		await fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
		await settle();
		expect(server.requestsTo("/api/teams/ABC123/members/me")).toHaveLength(0);

		server.on("GET", "/api/teams/ABC123", jsonResponse(200, stranger(lions)));
		await fireEvent.click(screen.getByRole("button", { name: "Leave team" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Leave team?" })).getByRole("button", { name: "Leave" }));
		await settle();

		expect(server.requestsTo("/api/teams/ABC123/members/me")).toHaveLength(1);
		expect(screen.queryByRole("region", { name: "Members" })).toBeNull();
		expect(teamSection()).toHaveTextContent("You left “Lions”.");
		expect(within(teamSection()).getByRole("button", { name: "Ask to join" })).toBeInTheDocument();
	});

	it("tells the last Admin that they can't leave", async () => {
		await renderTeam();
		server.on("DELETE", "/api/teams/ABC123/members/me", problemResponse(409, { type: "https://tacticalboard/errors/last-team-admin" }));

		await fireEvent.click(screen.getByRole("button", { name: "Leave team" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Leave team?" })).getByRole("button", { name: "Leave" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Members" })).getAllByRole("alert").at(-1)).toHaveTextContent(
			"You're the last Admin of “Lions”. Make another member Admin first, or delete the team.",
		);
	});

	it("asks before an Admin deletes the team, then opens the start page", async () => {
		await renderTeam();
		server.on("DELETE", "/api/teams/ABC123", new Response(null, { status: 204 }));
		const section = screen.getByRole("region", { name: "Delete team" });
		expect(section).toHaveTextContent("Deleting the team also deletes its memberships, its join requests and all its folders and situations.");

		await fireEvent.click(within(section).getByRole("button", { name: "Delete team" }));
		await settle();
		const question = screen.getByRole("alertdialog", { name: "Delete team?" });
		expect(question).toHaveTextContent("“Lions” will be deleted with its members, join requests, folders and situations.");
		await fireEvent.click(within(question).getByRole("button", { name: "Cancel" }));
		await settle();
		expect(server.requestsTo("/api/teams/ABC123").filter((request) => request.method === "DELETE")).toHaveLength(0);

		await fireEvent.click(within(section).getByRole("button", { name: "Delete team" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete team?" })).getByRole("button", { name: "Delete" }));
		await settle();

		expect(server.requestsTo("/api/teams/ABC123").filter((request) => request.method === "DELETE")).toHaveLength(1);
		expect(goto).toHaveBeenCalledWith("/");
	});

	it("says why the team couldn't be deleted", async () => {
		await renderTeam();
		server.on("DELETE", "/api/teams/ABC123", problemResponse(500, {}));

		await fireEvent.click(screen.getByRole("button", { name: "Delete team" }));
		await settle();
		await fireEvent.click(within(screen.getByRole("alertdialog", { name: "Delete team?" })).getByRole("button", { name: "Delete" }));
		await settle();

		expect(within(screen.getByRole("region", { name: "Delete team" })).getByRole("alert")).toHaveTextContent("The team couldn't be deleted.");
		expect(goto).not.toHaveBeenCalled();
	});

	it("shows an Admin every section in order", async () => {
		await renderTeam();

		expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-labelledby") && document.getElementById(region.getAttribute("aria-labelledby")!)?.firstChild?.textContent?.trim())).toEqual([
			"Team",
			"Logo",
			"Join requests",
			"Members",
			"Delete team",
		]);
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

	it("removes the logo at once, without asking", async () => {
		await renderTeam({ ...lions, logoUrl: "/api/teams/t1/logo?v=1" });
		server.on("DELETE", "/api/teams/ABC123/logo", new Response(null, { status: 204 }));

		await fireEvent.click(screen.getByRole("button", { name: "Remove logo" }));
		await settle();

		expect(screen.queryByRole("alertdialog")).toBeNull();
		expect(server.requestsTo("/api/teams/ABC123/logo")).toHaveLength(1);
		expect(within(teamSection()).queryByRole("img")).toBeNull();
		expect(screen.getByRole("region", { name: "Logo" })).toHaveTextContent("No logo.");
		expect(within(screen.getByRole("region", { name: "Logo" })).getByRole("status")).toHaveTextContent("Logo removed.");
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
		render(TeamRoutePage, { props: { data: { team: "ABC123" } } });
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
