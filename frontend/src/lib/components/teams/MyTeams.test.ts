import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/svelte";
import MyTeams from "./MyTeams.svelte";

describe("MyTeams", () => {
	afterEach(() => cleanup());

	it("says it is loading", () => {
		render(MyTeams, {
			props: { list: { status: "loading" }, onRetry: vi.fn() },
		});

		expect(screen.getByRole("status")).toHaveTextContent("Loading teams…");
	});

	it("offers to try again after a failure", async () => {
		const onRetry = vi.fn();
		render(MyTeams, {
			props: { list: { status: "failed", message: () => "Boom." }, onRetry },
		});

		expect(screen.getByRole("alert")).toHaveTextContent("Boom.");
		await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledOnce();
	});

	it("says when the user is in no team", () => {
		render(MyTeams, {
			props: { list: { status: "loaded", teams: [] }, onRetry: vi.fn() },
		});

		expect(screen.getByText(/You're not in any team yet/)).toBeInTheDocument();
	});

	it("lists the teams with their roles", () => {
		render(MyTeams, {
			props: {
				list: {
					status: "loaded",
					teams: [
						{
							id: "t1",
							code: "ABC123",
							name: "Lions",
							logoUrl: null,
							role: "editor",
							pendingJoinRequests: null,
						},
						{
							id: "t2",
							code: "XYZ789",
							name: "Tigers",
							logoUrl: null,
							role: "admin",
							pendingJoinRequests: 2,
						},
					],
				},
				onRetry: vi.fn(),
			},
		});

		const link = screen.getByRole("link", { name: /Lions/ });
		expect(link).toHaveAttribute("href", "/teams/ABC123");
		expect(screen.getByRole("list", { name: "Your teams" })).toHaveTextContent("Editor");
		expect(link).not.toHaveTextContent("join request");
		expect(screen.getByRole("link", { name: /Tigers/ })).toHaveTextContent("2 join requests");
	});
});
