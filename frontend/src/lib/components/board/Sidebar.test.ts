import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/svelte";
import Sidebar from "./Sidebar.svelte";

describe("Sidebar", () => {
	it("marks the active tool as pressed", () => {
		render(Sidebar, { props: { activeTool: "Move", selectedColor: "oklch(62% 0.16 230)" } });

		expect(screen.getByRole("button", { name: "Move" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Player" })).toHaveAttribute("aria-pressed", "false");
	});

	it("selecting a tool marks it pressed instead of Move", async () => {
		render(Sidebar, { props: { activeTool: "Move", selectedColor: "oklch(62% 0.16 230)" } });

		await fireEvent.click(screen.getByRole("button", { name: "Ball" }));

		expect(screen.getByRole("button", { name: "Ball" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Move" })).toHaveAttribute("aria-pressed", "false");
	});

	it("Pass, Run and Shot are disabled (not implemented yet)", () => {
		render(Sidebar, { props: { activeTool: "Move", selectedColor: "oklch(62% 0.16 230)" } });

		for (const name of ["Pass", "Run", "Shot"]) {
			expect(screen.getByRole("button", { name })).toBeDisabled();
		}
	});

	it("shows the player-color swatches only when Player is active", async () => {
		render(Sidebar, { props: { activeTool: "Move", selectedColor: "oklch(62% 0.16 230)" } });

		expect(screen.queryByText("Player color")).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Player" }));

		expect(screen.getByText("Player color")).toBeInTheDocument();
	});

	it("clicking a color swatch marks it pressed", async () => {
		render(Sidebar, { props: { activeTool: "Player", selectedColor: "oklch(62% 0.16 230)" } });

		const teamB = screen.getByRole("button", { name: "Team B" });
		await fireEvent.click(teamB);

		expect(teamB).toHaveAttribute("aria-pressed", "true");
	});
});
