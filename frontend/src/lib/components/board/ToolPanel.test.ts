import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/svelte";
import ToolPanel from "./ToolPanel.svelte";
import type { Tool } from "$lib/board/ToolState";

const TEAM_A = "oklch(62% 0.16 230)";
const TEAM_B = "oklch(64% 0.16 32)";

function props(overrides: Record<string, unknown> = {}) {
	return {
		activeTool: "Move" as Tool,
		playerColor: TEAM_A,
		onSelectTool: vi.fn(),
		onSelectPlayerColor: vi.fn(),
		...overrides,
	};
}

describe("ToolPanel", () => {
	describe("semantics", () => {
		it("is a complementary landmark named Tools", () => {
			render(ToolPanel, { props: props() });

			expect(screen.getByRole("complementary", { name: "Tools" })).toBeInTheDocument();
		});

		it("has an Elements heading and lists one button per element kind", () => {
			render(ToolPanel, { props: props() });

			const section = screen.getByRole("region", { name: "Elements" });
			expect(within(section).getByRole("heading", { level: 2, name: "Elements" })).toBeInTheDocument();
			const items = within(within(section).getByRole("list")).getAllByRole("listitem");
			expect(items).toHaveLength(8);
			for (const item of items) {
				expect(within(item).getByRole("button")).toBeInTheDocument();
			}
		});

		it("gives every tool button an accessible name (also when shown icon-only)", () => {
			render(ToolPanel, { props: props() });

			for (const name of ["Move", "Player", "Ball", "Pass", "Run", "Shot", "Rectangle", "Triangle", "Circle"]) {
				expect(screen.getByRole("button", { name })).toBeInTheDocument();
			}
		});

		it("lists the player colors under a Player color heading", () => {
			render(ToolPanel, { props: props({ activeTool: "Player" }) });

			const section = screen.getByRole("region", { name: "Player color" });
			expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent("Player color");
			const items = within(within(section).getByRole("list")).getAllByRole("listitem");
			expect(items.map((item) => within(item).getByRole("button").getAttribute("aria-label"))).toEqual([
				"Team A",
				"Team B",
				"Team C",
				"Team D",
			]);
		});

		it("uses type=button so nothing submits a form", () => {
			render(ToolPanel, { props: props({ activeTool: "Player" }) });

			for (const button of screen.getAllByRole("button")) {
				expect(button).toHaveAttribute("type", "button");
			}
		});
	});

	it("marks the active tool as pressed", () => {
		render(ToolPanel, { props: props() });

		expect(screen.getByRole("button", { name: "Move" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Player" })).toHaveAttribute("aria-pressed", "false");
	});

	it("selecting a tool reports it", async () => {
		const onSelectTool = vi.fn();
		render(ToolPanel, { props: props({ onSelectTool }) });

		await fireEvent.click(screen.getByRole("button", { name: "Ball" }));

		expect(onSelectTool).toHaveBeenCalledWith("Ball");
	});

	it("selecting Move reports it", async () => {
		const onSelectTool = vi.fn();
		render(ToolPanel, { props: props({ activeTool: "Player", onSelectTool }) });

		await fireEvent.click(screen.getByRole("button", { name: "Move" }));

		expect(onSelectTool).toHaveBeenCalledWith("Move");
	});

	it("marks a newly active tool pressed instead of Move", async () => {
		const { rerender } = render(ToolPanel, { props: props() });

		await rerender(props({ activeTool: "Ball" }));

		expect(screen.getByRole("button", { name: "Ball" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Move" })).toHaveAttribute("aria-pressed", "false");
	});

	it("Pass, Run and Shot are enabled arrow tools", async () => {
		const onSelectTool = vi.fn();
		render(ToolPanel, { props: props({ onSelectTool }) });

		for (const name of ["Pass", "Run", "Shot"]) {
			const button = screen.getByRole("button", { name });
			expect(button).toBeVisible();
			expect(button).toBeEnabled();
			await fireEvent.click(button);
		}
		expect(onSelectTool.mock.calls).toEqual([["Pass"], ["Run"], ["Shot"]]);
	});

	it("no tool is disabled", () => {
		render(ToolPanel, { props: props({ activeTool: "Player" }) });

		for (const button of screen.getAllByRole("button")) {
			expect(button).toBeEnabled();
		}
	});

	it("marks an active arrow tool pressed and hides the player colors", () => {
		render(ToolPanel, { props: props({ activeTool: "Run" }) });

		expect(screen.getByRole("button", { name: "Run" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.queryByText("Player color")).not.toBeInTheDocument();
	});

	it("shows the player-color swatches only when Player is active", async () => {
		const { rerender } = render(ToolPanel, { props: props() });

		expect(screen.queryByText("Player color")).not.toBeInTheDocument();

		await rerender(props({ activeTool: "Player" }));

		expect(screen.getByText("Player color")).toBeInTheDocument();
	});

	it("marks the current player color pressed", () => {
		render(ToolPanel, { props: props({ activeTool: "Player", playerColor: TEAM_B }) });

		expect(screen.getByRole("button", { name: "Team B" })).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByRole("button", { name: "Team A" })).toHaveAttribute("aria-pressed", "false");
	});

	it("clicking a color swatch reports the color", async () => {
		const onSelectPlayerColor = vi.fn();
		render(ToolPanel, { props: props({ activeTool: "Player", onSelectPlayerColor }) });

		await fireEvent.click(screen.getByRole("button", { name: "Team B" }));

		expect(onSelectPlayerColor).toHaveBeenCalledWith(TEAM_B);
	});
});
