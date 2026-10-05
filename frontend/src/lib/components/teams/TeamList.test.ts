import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/svelte";
import { i18n } from "$lib/i18n";
import TeamList from "./TeamList.svelte";

const teams = [
	{
		id: "t1",
		code: "ABC123",
		name: "Lions",
		logoUrl: "/api/teams/ABC123/logo?v=1",
		role: "admin" as const,
	},
	{ id: "t2", code: "XYZ789", name: "Tigers", logoUrl: null },
];

describe("TeamList", () => {
	afterEach(() => cleanup());

	it("is a list of links to the teams' pages with logo, name and code", () => {
		render(TeamList, { props: { teams, label: "Your teams" } });

		const list = screen.getByRole("list", { name: "Your teams" });
		const links = within(list).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["/teams/ABC123", "/teams/XYZ789"]);
		expect(links[0]).toHaveTextContent("Lions");
		expect(links[0]).toHaveTextContent("Code ABC123");
		expect(links[0].querySelector("img")).toHaveAttribute("alt", "");
	});

	it("shows the user's role where it is known, in the UI language", () => {
		render(TeamList, { props: { teams } });

		const [lions, tigers] = screen.getAllByRole("listitem");
		expect(lions).toHaveTextContent("Admin");
		expect(tigers).not.toHaveTextContent("Admin");
	});

	it("words the roles in German", async () => {
		i18n.select("de");
		render(TeamList, {
			props: {
				teams: [
					{ ...teams[0], role: "reader" as const },
					{ ...teams[1], role: "editor" as const },
				],
			},
		});

		expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([expect.stringContaining("Leser"), expect.stringContaining("Bearbeiter")]);
	});
});
