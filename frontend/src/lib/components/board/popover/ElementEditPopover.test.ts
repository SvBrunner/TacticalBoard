import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import ElementEditPopover from "./ElementEditPopover.svelte";
import { PointElement } from "$lib/model/elements/PointElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { ScreenRect } from "$lib/board/BoardViewport";
import { PopoverPlacement } from "./PopoverPlacement";

const TEAM_A = "oklch(62% 0.16 230)";
const TEAM_B = "oklch(64% 0.16 32)";
const player = new PointElement("el-1", 10, 20, TEAM_A, "Player");
const circle = new PointElement("el-2", 10, 20, "grey", "Circle");
const anchor: ScreenRect = { x: 100, y: 50, width: 40, height: 40 };

function fakeActions() {
	return { changeType: vi.fn(), changeColor: vi.fn(), removeElement: vi.fn() };
}

function props(overrides: Record<string, unknown> = {}) {
	return {
		element: player as BoardElement | null,
		anchor: anchor as ScreenRect | null,
		actions: fakeActions(),
		onClose: vi.fn(),
		...overrides,
	};
}

describe("ElementEditPopover", () => {
	it("renders nothing without an element", () => {
		render(ElementEditPopover, { props: props({ element: null }) });

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.queryByText("Edit marker")).not.toBeInTheDocument();
	});

	it("is an open dialog named by its heading", () => {
		render(ElementEditPopover, { props: props() });

		const dialog = screen.getByRole("dialog", { name: "Edit marker" });
		expect(dialog.tagName).toBe("DIALOG");
		expect(dialog).toHaveAttribute("open");
		expect(within(dialog).getByRole("heading", { level: 2, name: "Edit marker" })).toBeInTheDocument();
	});

	it("moves focus into the dialog when it opens", () => {
		render(ElementEditPopover, { props: props() });

		expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
	});

	it("moves focus into the dialog again when opened for another element", async () => {
		const { rerender } = render(ElementEditPopover, { props: props({ element: null }) });
		(document.activeElement as HTMLElement | null)?.blur();

		await rerender(props({ element: circle }));

		expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
	});

	describe("Type", () => {
		it("is a fieldset with a Type legend containing a list of type buttons", () => {
			render(ElementEditPopover, { props: props() });

			const group = screen.getByRole("group", { name: "Type" });
			expect(group.tagName).toBe("FIELDSET");
			const items = within(within(group).getByRole("list")).getAllByRole("listitem");
			expect(items).toHaveLength(8);
		});

		it("marks the element's current type pressed", () => {
			render(ElementEditPopover, { props: props() });

			expect(screen.getByRole("button", { name: "Player" })).toHaveAttribute("aria-pressed", "true");
			expect(screen.getByRole("button", { name: "Triangle" })).toHaveAttribute("aria-pressed", "false");
		});

		it("picking a type changes the element's type", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ actions }) });

			await fireEvent.click(screen.getByRole("button", { name: "Triangle" }));

			expect(actions.changeType).toHaveBeenCalledWith("el-1", "Triangle");
		});

		it("shows the new type pressed once the element has changed", async () => {
			const { rerender } = render(ElementEditPopover, { props: props() });

			await rerender(props({ element: player.withType("Triangle") }));

			expect(screen.getByRole("button", { name: "Triangle" })).toHaveAttribute("aria-pressed", "true");
			expect(screen.getByRole("button", { name: "Player" })).toHaveAttribute("aria-pressed", "false");
		});

		it("disabled types cannot be picked", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ actions }) });

			for (const name of ["Pass", "Run", "Shot"]) {
				const button = screen.getByRole("button", { name });
				expect(button).toBeDisabled();
				await fireEvent.click(button);
			}

			expect(actions.changeType).not.toHaveBeenCalled();
		});
	});

	describe("Player color", () => {
		it("is a fieldset with a legend and a list of named swatches for players", () => {
			render(ElementEditPopover, { props: props() });

			const group = screen.getByRole("group", { name: "Player color" });
			expect(group.tagName).toBe("FIELDSET");
			const items = within(within(group).getByRole("list")).getAllByRole("listitem");
			expect(items.map((item) => within(item).getByRole("button").getAttribute("aria-label"))).toEqual([
				"Team A",
				"Team B",
				"Team C",
				"Team D",
			]);
		});

		it("is only shown when the element is a Player", () => {
			render(ElementEditPopover, { props: props({ element: circle }) });

			expect(screen.queryByRole("group", { name: "Player color" })).not.toBeInTheDocument();
			expect(screen.queryByText("Player color")).not.toBeInTheDocument();
		});

		it("marks the element's color pressed", () => {
			render(ElementEditPopover, { props: props() });

			expect(screen.getByRole("button", { name: "Team A" })).toHaveAttribute("aria-pressed", "true");
			expect(screen.getByRole("button", { name: "Team B" })).toHaveAttribute("aria-pressed", "false");
		});

		it("picking a color changes the element's color", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ actions }) });

			await fireEvent.click(screen.getByRole("button", { name: "Team B" }));

			expect(actions.changeColor).toHaveBeenCalledWith("el-1", TEAM_B);
		});
	});

	it("Delete marker removes the element and closes", async () => {
		const actions = fakeActions();
		const onClose = vi.fn();
		render(ElementEditPopover, { props: props({ actions, onClose }) });

		await fireEvent.click(screen.getByRole("button", { name: /delete marker/i }));

		expect(actions.removeElement).toHaveBeenCalledWith("el-1");
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("Close calls onClose without editing", async () => {
		const actions = fakeActions();
		const onClose = vi.fn();
		render(ElementEditPopover, { props: props({ actions, onClose }) });

		await fireEvent.click(screen.getByRole("button", { name: "Close" }));

		expect(onClose).toHaveBeenCalledOnce();
		expect(actions.removeElement).not.toHaveBeenCalled();
	});

	it("Escape closes", async () => {
		const onClose = vi.fn();
		render(ElementEditPopover, { props: props({ onClose }) });

		await fireEvent.keyDown(screen.getByRole("button", { name: "Team B" }), { key: "Escape" });

		expect(onClose).toHaveBeenCalledOnce();
	});

	it("other keys do not close", async () => {
		const onClose = vi.fn();
		render(ElementEditPopover, { props: props({ onClose }) });

		await fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });

		expect(onClose).not.toHaveBeenCalled();
	});

	it("all buttons are type=button", () => {
		render(ElementEditPopover, { props: props() });

		for (const button of screen.getAllByRole("button")) {
			expect(button).toHaveAttribute("type", "button");
		}
	});

	it("positions itself next to the anchor via CSS custom properties", () => {
		const placement = new PopoverPlacement();
		const place = vi.spyOn(placement, "place").mockReturnValue({ x: 12, y: 34, side: "above" });
		render(ElementEditPopover, { props: props({ placement }) });

		const dialog = screen.getByRole("dialog");
		expect(place).toHaveBeenCalledWith(anchor, expect.any(Object), { width: window.innerWidth, height: window.innerHeight });
		expect(dialog.style.getPropertyValue("--anchor-x")).toBe("12px");
		expect(dialog.style.getPropertyValue("--anchor-y")).toBe("34px");
		expect(dialog).toHaveAttribute("data-side", "above");
	});

	it("sets no anchor position without an anchor", () => {
		render(ElementEditPopover, { props: props({ anchor: null }) });

		expect(screen.getByRole("dialog").style.getPropertyValue("--anchor-x")).toBe("");
	});
});
