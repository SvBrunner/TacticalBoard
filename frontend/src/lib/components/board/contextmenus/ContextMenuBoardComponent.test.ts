import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/svelte";
import ContextMenuBoardComponent from "./ContextMenuBoardComponent.svelte";
import { board } from "../Board";

function fakeMouseEvent() {
	return { clientX: 10, clientY: 20 } as MouseEvent;
}

describe("ContextMenuBoardComponent", () => {
	it("is hidden until showRightClickContextMenu is called", () => {
		render(ContextMenuBoardComponent);

		expect(screen.queryByText("Edit marker")).not.toBeInTheDocument();
	});

	it("shows the popover for the targeted element", async () => {
		const { component } = render(ContextMenuBoardComponent);

		component.showRightClickContextMenu(fakeMouseEvent(), "el-1", "Player", "oklch(62% 0.16 230)");
		await Promise.resolve();

		expect(screen.getByText("Edit marker")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Player" })).toHaveAttribute("aria-pressed", "true");
	});

	it("only shows the Player-color row when the target is a Player", async () => {
		const { component } = render(ContextMenuBoardComponent);

		component.showRightClickContextMenu(fakeMouseEvent(), "el-1", "Circle", "oklch(62% 0.16 230)");
		await Promise.resolve();

		expect(screen.queryByText("Player color")).not.toBeInTheDocument();
	});

	it("closing the popover hides it", async () => {
		const { component } = render(ContextMenuBoardComponent);

		component.showRightClickContextMenu(fakeMouseEvent(), "el-1", "Player", "oklch(62% 0.16 230)");
		await Promise.resolve();

		await fireEvent.click(screen.getByRole("button", { name: "Close" }));

		expect(screen.queryByText("Edit marker")).not.toBeInTheDocument();
	});

	it("Delete marker removes the targeted element from the board", async () => {
		const removeSpy = vi.spyOn(board, "removeElement");
		const { component } = render(ContextMenuBoardComponent);

		component.showRightClickContextMenu(fakeMouseEvent(), "el-1", "Player", "oklch(62% 0.16 230)");
		await Promise.resolve();

		await fireEvent.click(screen.getByRole("button", { name: /delete marker/i }));

		expect(removeSpy).toHaveBeenCalledWith("el-1");
		expect(screen.queryByText("Edit marker")).not.toBeInTheDocument();

		removeSpy.mockRestore();
	});
});
