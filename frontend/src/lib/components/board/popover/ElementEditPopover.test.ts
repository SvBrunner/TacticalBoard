import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/svelte";
import ElementEditPopover from "./ElementEditPopover.svelte";
import { PointElement } from "$lib/model/elements/PointElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { ScreenRect } from "$lib/board/BoardViewport";
import { PopoverPlacement } from "./PopoverPlacement";
import { PositionCatalog } from "$lib/model/positions/PositionCatalog";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";

const TEAM_A = "oklch(62% 0.16 230)";
const TEAM_B = "oklch(64% 0.16 32)";
const player = new PointElement("el-1", 10, 20, TEAM_A, "Player");
const circle = new PointElement("el-2", 10, 20, "grey", "Circle");
const anchor: ScreenRect = { x: 100, y: 50, width: 40, height: 40 };

function fakeActions() {
	return {
		changeType: vi.fn(),
		changeColor: vi.fn(),
		changeLabel: vi.fn(),
		removeBend: vi.fn(),
		straightenArrow: vi.fn(),
		removeElement: vi.fn(),
		endGesture: vi.fn(),
	};
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
			expect(items).toHaveLength(5);
		});

		it("offers only the point types for a point element", () => {
			render(ElementEditPopover, { props: props() });

			const group = screen.getByRole("group", { name: "Type" });
			expect(within(group).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual([
				"Player",
				"Ball",
				"Rectangle",
				"Triangle",
				"Circle",
			]);
			for (const name of ["Pass", "Run", "Shot"]) {
				expect(within(group).queryByRole("button", { name })).not.toBeInTheDocument();
			}
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

	});

	describe("Color", () => {
		const PALETTE = ["Team A", "Team B", "Team C", "Team D", "Grey", "Black"];

		it("is a fieldset with a Player color legend and a list of named swatches for players", () => {
			render(ElementEditPopover, { props: props() });

			const group = screen.getByRole("group", { name: "Player color" });
			expect(group.tagName).toBe("FIELDSET");
			const items = within(within(group).getByRole("list")).getAllByRole("listitem");
			expect(items.map((item) => within(item).getByRole("button").getAttribute("aria-label"))).toEqual(PALETTE);
		});

		it.each([["Ball"], ["Rectangle"], ["Triangle"], ["Circle"]] as const)("is offered for a %s too, as Color", (type) => {
			render(ElementEditPopover, { props: props({ element: player.withType(type) }) });

			const group = screen.getByRole("group", { name: "Color" });
			expect(within(group).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual(PALETTE);
		});

		it("picking a color for a marker changes its color", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ element: circle, actions }) });

			await fireEvent.click(screen.getByRole("button", { name: "Black" }));

			expect(actions.changeColor).toHaveBeenCalledWith("el-2", "oklch(15% 0 0)");
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

	describe("Position", () => {
		it("is shown for a Player", () => {
			render(ElementEditPopover, { props: props() });

			expect(screen.getByRole("group", { name: "Position" })).toBeInTheDocument();
		});

		it.each([["Ball"], ["Circle"], ["Rectangle"], ["Triangle"]] as const)("is not shown for a %s", (type) => {
			render(ElementEditPopover, { props: props({ element: player.withLabel("C").withType(type) }) });

			expect(screen.queryByRole("group", { name: "Position" })).not.toBeInTheDocument();
			expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
		});

		it("appears again with the kept label when the element changes back to a Player", async () => {
			const labeled = player.withLabel("LV");
			const { rerender } = render(ElementEditPopover, { props: props({ element: labeled.withType("Circle") }) });

			await rerender(props({ element: labeled.withType("Circle").withType("Player") }));

			expect(screen.getByRole("radio", { name: /^LV\b/ })).toBeChecked();
			expect(screen.getByRole("textbox", { name: "Custom" })).toHaveValue("LV");
		});

		it("picking a position changes the label through the actions", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ actions }) });

			await fireEvent.click(screen.getByRole("radio", { name: /^G\b/ }));

			expect(actions.changeLabel).toHaveBeenCalledWith("el-1", "G");
		});

		it("offers the positions of the given catalog", () => {
			render(ElementEditPopover, { props: props({ positions: PositionCatalog.forSport("floorball") }) });

			expect(within(screen.getByRole("group", { name: "Position" })).getAllByRole("radio")).toHaveLength(9);
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

	describe("for an arrow", () => {
		const geometry = new ArrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 30, y: 30 }, { x: 60, y: 30 }]);
		const pass = new ArrowElement("arrow-1", "Pass", "oklch(15% 0 0)", geometry);
		const straightPass = pass.withGeometry(geometry.straightened());

		it("is named Edit arrow", () => {
			render(ElementEditPopover, { props: props({ element: pass }) });

			expect(screen.getByRole("dialog", { name: "Edit arrow" })).toBeInTheDocument();
		});

		it("offers only the arrow types, the current one pressed", () => {
			render(ElementEditPopover, { props: props({ element: pass }) });

			const group = screen.getByRole("group", { name: "Type" });
			expect(within(group).getAllByRole("button").map((button) => button.textContent?.trim())).toEqual(["Pass", "Run", "Shot"]);
			expect(within(group).getByRole("button", { name: "Pass" })).toHaveAttribute("aria-pressed", "true");
		});

		it("picking a type changes the arrow's type", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ element: pass, actions }) });

			await fireEvent.click(screen.getByRole("button", { name: "Shot" }));

			expect(actions.changeType).toHaveBeenCalledWith("arrow-1", "Shot");
		});

		it("offers the color palette with the arrow's color (black) pressed", async () => {
			const actions = fakeActions();
			render(ElementEditPopover, { props: props({ element: pass, actions }) });

			const group = screen.getByRole("group", { name: "Color" });
			expect(within(group).getByRole("button", { name: "Black" })).toHaveAttribute("aria-pressed", "true");
			await fireEvent.click(within(group).getByRole("button", { name: "Team B" }));
			expect(actions.changeColor).toHaveBeenCalledWith("arrow-1", TEAM_B);
		});

		it("has no position label", () => {
			render(ElementEditPopover, { props: props({ element: pass }) });

			expect(screen.queryByRole("group", { name: "Position" })).not.toBeInTheDocument();
		});

		it("offers Straighten only when the arrow is bent", async () => {
			const actions = fakeActions();
			const { rerender } = render(ElementEditPopover, { props: props({ element: pass, actions }) });

			await fireEvent.click(screen.getByRole("button", { name: "Straighten" }));
			expect(actions.straightenArrow).toHaveBeenCalledWith("arrow-1");

			await rerender(props({ element: straightPass, actions }));
			expect(screen.queryByRole("button", { name: "Straighten" })).not.toBeInTheDocument();
		});

		it("offers Remove bend only for an active bend of this arrow", async () => {
			const actions = fakeActions();
			const { rerender } = render(ElementEditPopover, { props: props({ element: pass, actions }) });
			expect(screen.queryByRole("button", { name: "Remove bend" })).not.toBeInTheDocument();

			await rerender(props({ element: pass, actions, bendIndex: 1 }));
			await fireEvent.click(screen.getByRole("button", { name: "Remove bend" }));
			expect(actions.removeBend).toHaveBeenCalledWith("arrow-1", 1);

			await rerender(props({ element: straightPass, actions, bendIndex: 1 }));
			expect(screen.queryByRole("button", { name: "Remove bend" })).not.toBeInTheDocument();
		});

		it("explains how to add and remove bends in a Bends group", () => {
			render(ElementEditPopover, { props: props({ element: straightPass }) });

			const group = screen.getByRole("group", { name: "Bends" });
			expect(group.tagName).toBe("FIELDSET");
			expect(within(group).getByText(/add a bend/i)).toBeInTheDocument();
			expect(within(group).getByText(/remove it/i)).toBeInTheDocument();
		});

		it("offers Edit shape when the owner handles it", async () => {
			const onEditShape = vi.fn();
			const { rerender } = render(ElementEditPopover, { props: props({ element: straightPass }) });
			expect(screen.queryByRole("button", { name: "Edit shape" })).not.toBeInTheDocument();
			expect(within(screen.getByRole("group", { name: "Bends" })).queryByRole("list")).not.toBeInTheDocument();

			await rerender(props({ element: straightPass, onEditShape }));
			await fireEvent.click(screen.getByRole("button", { name: "Edit shape" }));

			expect(onEditShape).toHaveBeenCalledOnce();
		});

		it("point elements have no Bends group, even with a bend index", () => {
			render(ElementEditPopover, { props: props({ bendIndex: 0 }) });

			expect(screen.queryByRole("group", { name: "Bends" })).not.toBeInTheDocument();
			expect(screen.queryByRole("button", { name: "Remove bend" })).not.toBeInTheDocument();
		});

		it("Delete arrow removes the arrow and closes", async () => {
			const actions = fakeActions();
			const onClose = vi.fn();
			render(ElementEditPopover, { props: props({ element: pass, actions, onClose }) });

			await fireEvent.click(screen.getByRole("button", { name: /delete arrow/i }));

			expect(actions.removeElement).toHaveBeenCalledWith("arrow-1");
			expect(onClose).toHaveBeenCalledOnce();
		});

		it("all buttons are type=button", () => {
			render(ElementEditPopover, { props: props({ element: pass, bendIndex: 0 }) });

			for (const button of screen.getAllByRole("button")) {
				expect(button).toHaveAttribute("type", "button");
			}
		});
	});
});
