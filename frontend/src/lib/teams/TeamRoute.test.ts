import { describe, it, expect } from "vitest";
import { TeamRoute } from "./TeamRoute";

describe("TeamRoute", () => {
	it("has the overview and a page per team code or id", () => {
		expect(TeamRoute.OVERVIEW).toBe("/teams");
		expect(TeamRoute.forTeam("ABC123")).toBe("/teams/ABC123");
		expect(TeamRoute.forTeam("a b")).toBe("/teams/a%20b");
	});

	it("links a team by its code when the user has it, otherwise by its id", () => {
		expect(TeamRoute.of({ id: "t1", code: "ABC123" })).toBe("/teams/ABC123");
		expect(TeamRoute.of({ id: "t1", code: null })).toBe("/teams/t1");
	});

	it("builds the full link to share", () => {
		expect(TeamRoute.linkTo("ABC123", "https://tb.example.org")).toBe("https://tb.example.org/teams/ABC123");
	});
});
