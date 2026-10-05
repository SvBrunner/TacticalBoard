import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { BoardViewport } from "$lib/board/BoardViewport";
import { PointElement } from "$lib/model/elements/PointElement";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { Frame } from "$lib/model/Frame";
import { FrameReorderGesture } from "./FrameReorderGesture";
import FrameStrip from "./FrameStrip.svelte";

const viewport = new BoardViewport(FieldDimensions.FLOORBALL, "full");

const FRAMES = [
	new Frame("f1", "", [new PointElement("p", 100, 100, "red", "Player")]),
	new Frame("f2", "", [new PointElement("p", 500, 500, "red", "Player")]),
	new Frame("f3", "", []),
	new Frame("f4", "", []),
];

/** Item layout faked for jsdom (no layout engine): 60 px wide items with 8 px gaps, centers at 30, 98, 166, 234. */
const ITEM_WIDTH = 60;
const ITEM_STEP = 68;

function renderStrip(overrides: Partial<{ frames: readonly Frame[]; activeFrameId: string; playing: boolean; readonly: boolean }> = {}) {
	const handlers = {
		onSelect: vi.fn<(id: string) => void>(),
		onAdd: vi.fn<() => void>(),
		onDelete: vi.fn<(id: string) => void>(),
		onMove: vi.fn<(id: string, toIndex: number) => void>(),
	};
	const result = render(FrameStrip, {
		props: { frames: FRAMES, activeFrameId: "f1", viewport, ...handlers, ...overrides },
	});
	const nav = screen.getByRole("navigation", { name: "Frames" });
	const items = () => within(nav).getAllByRole("listitem");
	items().forEach((item, index) => {
		Object.defineProperty(item, "offsetLeft", { configurable: true, value: index * ITEM_STEP });
		Object.defineProperty(item, "offsetWidth", { configurable: true, value: ITEM_WIDTH });
	});
	return { ...result, ...handlers, nav, items };
}

const frameButton = (number: number) => screen.getByRole("button", { name: `Frame ${number}` });

function press(item: HTMLElement, clientX: number, pointerType = "mouse", button = 0) {
	return fireEvent.pointerDown(item, { pointerId: 1, pointerType, clientX, clientY: 20, button });
}

function moveTo(clientX: number, pointerType = "mouse") {
	return fireEvent.pointerMove(window, { pointerId: 1, pointerType, clientX, clientY: 20 });
}

function release(clientX: number, pointerType = "mouse") {
	return fireEvent.pointerUp(window, { pointerId: 1, pointerType, clientX, clientY: 20 });
}

describe("FrameStrip", () => {
	describe("structure", () => {
		it("is a navigation landmark with an ordered list of frames", () => {
			const { nav, items } = renderStrip();

			expect(nav.tagName).toBe("NAV");
			expect(within(nav).getByRole("list").tagName).toBe("OL");
			expect(items()).toHaveLength(4);
		});

		it("numbers the frames in order; each frame is a button", () => {
			renderStrip();

			[1, 2, 3, 4].forEach((number) => expect(frameButton(number).tagName).toBe("BUTTON"));
		});

		it("marks only the active frame with aria-current=step", () => {
			renderStrip({ activeFrameId: "f3" });

			expect(frameButton(3)).toHaveAttribute("aria-current", "step");
			[1, 2, 4].forEach((number) => expect(frameButton(number)).not.toHaveAttribute("aria-current"));
		});

		it("shows a thumbnail of each frame's content", () => {
			renderStrip();

			const thumbnails = [1, 2, 3, 4].map((number) => frameButton(number).querySelector("svg.frame-thumbnail"));
			expect(thumbnails.every((thumbnail) => thumbnail !== null)).toBe(true);
			expect(thumbnails[0]!.querySelector('[data-element-id="p"]')).toHaveAttribute("cx", "100");
			expect(thumbnails[1]!.querySelector('[data-element-id="p"]')).toHaveAttribute("cx", "500");
			expect(thumbnails[2]!.querySelectorAll("[data-element-id]")).toHaveLength(0);
		});

		it("thumbnails follow the field type", () => {
			renderStrip();
			const halfRender = render(FrameStrip, {
				props: {
					frames: FRAMES,
					activeFrameId: "f1",
					viewport: new BoardViewport(FieldDimensions.FLOORBALL, "half"),
					onSelect: () => {},
					onAdd: () => {},
					onDelete: () => {},
					onMove: () => {},
				},
			});

			expect(halfRender.container.querySelector("svg.frame-thumbnail")).toHaveAttribute("data-field-type", "half");
		});

		it("updates the numbers and thumbnails when the frames change", async () => {
			const { rerender } = renderStrip();

			await rerender({ frames: [FRAMES[1], FRAMES[0]], activeFrameId: "f1" });

			expect(frameButton(2)).toHaveAttribute("aria-current", "step");
			expect(frameButton(1).querySelector('[data-element-id="p"]')).toHaveAttribute("cx", "500");
			expect(screen.queryByRole("button", { name: "Frame 3" })).not.toBeInTheDocument();
		});
	});

	describe("buttons", () => {
		it("a click on a frame selects it", async () => {
			const { onSelect } = renderStrip();

			await fireEvent.click(frameButton(2));

			expect(onSelect).toHaveBeenCalledWith("f2");
		});

		it("Add frame adds", async () => {
			const { onAdd } = renderStrip();

			await fireEvent.click(screen.getByRole("button", { name: "Add frame" }));

			expect(onAdd).toHaveBeenCalledOnce();
		});

		it("Delete frame asks to delete the active frame", async () => {
			const { onDelete } = renderStrip({ activeFrameId: "f2" });

			await fireEvent.click(screen.getByRole("button", { name: "Delete frame" }));

			expect(onDelete).toHaveBeenCalledWith("f2");
		});

		it("Delete frame is disabled with a single frame", async () => {
			const { onDelete } = renderStrip({ frames: [FRAMES[0]], activeFrameId: "f1" });
			const button = screen.getByRole("button", { name: "Delete frame" });

			expect(button).toBeDisabled();
			await fireEvent.click(button);
			expect(onDelete).not.toHaveBeenCalled();
		});

		it("the actions form a labelled group", () => {
			renderStrip();

			const group = screen.getByRole("group", { name: "Frame actions" });
			expect(within(group).getAllByRole("button")).toHaveLength(4);
		});
	});

	describe("keyboard alternative: Move frame left/right", () => {
		it("moves the active frame by one position", async () => {
			const { onMove } = renderStrip({ activeFrameId: "f2" });

			await fireEvent.click(screen.getByRole("button", { name: "Move frame left" }));
			await fireEvent.click(screen.getByRole("button", { name: "Move frame right" }));

			expect(onMove.mock.calls).toEqual([
				["f2", 0],
				["f2", 2],
			]);
		});

		it("can't move the first frame left or the last frame right", () => {
			renderStrip({ activeFrameId: "f1" });
			expect(screen.getByRole("button", { name: "Move frame left" })).toBeDisabled();
			expect(screen.getByRole("button", { name: "Move frame right" })).toBeEnabled();
		});

		it("disables Move frame right for the last frame", () => {
			renderStrip({ activeFrameId: "f4" });

			expect(screen.getByRole("button", { name: "Move frame right" })).toBeDisabled();
			expect(screen.getByRole("button", { name: "Move frame left" })).toBeEnabled();
		});

		it("disables both with a single frame", () => {
			renderStrip({ frames: [FRAMES[0]], activeFrameId: "f1" });

			expect(screen.getByRole("button", { name: "Move frame left" })).toBeDisabled();
			expect(screen.getByRole("button", { name: "Move frame right" })).toBeDisabled();
		});
	});

	describe("drag and drop (Pointer Events)", () => {
		it("mouse: dragging a frame past others reorders it", async () => {
			const { items, onMove } = renderStrip();

			await press(items()[0], 30);
			await moveTo(30 + 140);
			await release(30 + 140);

			expect(onMove).toHaveBeenCalledWith("f1", 2);
		});

		it("mouse: dragging backwards reorders it", async () => {
			const { items, onMove } = renderStrip();

			await press(items()[3], 234);
			await moveTo(234 - 210);
			await release(234 - 210);

			expect(onMove).toHaveBeenCalledWith("f4", 0);
		});

		it("the click following a drag does not select the frame", async () => {
			const { items, onSelect } = renderStrip();

			await press(items()[0], 30);
			await moveTo(170);
			await release(170);
			await fireEvent.click(frameButton(1));

			expect(onSelect).not.toHaveBeenCalled();
		});

		it("a later click selects again", async () => {
			vi.useFakeTimers();
			try {
				const { items, onSelect } = renderStrip();
				await press(items()[0], 30);
				await moveTo(170);
				await release(170);
				vi.runAllTimers();

				await fireEvent.click(frameButton(2));

				expect(onSelect).toHaveBeenCalledWith("f2");
			} finally {
				vi.useRealTimers();
			}
		});

		it("a press with a tiny movement is a tap: no reorder, the click selects", async () => {
			const { items, onMove, onSelect } = renderStrip();

			await press(items()[1], 98);
			await moveTo(98 + 4);
			await release(98 + 4);
			await fireEvent.click(frameButton(2));

			expect(onMove).not.toHaveBeenCalled();
			expect(onSelect).toHaveBeenCalledWith("f2");
		});

		it("dropping at the starting position doesn't reorder", async () => {
			const { items, onMove } = renderStrip();

			await press(items()[1], 98);
			await moveTo(98 + 20);
			await release(98 + 20);

			expect(onMove).not.toHaveBeenCalled();
		});

		it("the dragged frame follows the pointer and the others make room", async () => {
			const { items } = renderStrip();

			await press(items()[0], 30);
			await moveTo(170);

			expect(items()[0]).toHaveClass("dragged");
			expect(items()[0].style.transform).toBe("translateX(140px)");
			expect(items()[1].style.transform).toBe(`translateX(-${ITEM_STEP}px)`);
			expect(items()[2].style.transform).toBe(`translateX(-${ITEM_STEP}px)`);
			expect(items()[3].style.transform).toBe("");

			await release(170);
			expect(items().every((item) => item.style.transform === "")).toBe(true);
			expect(items()[0]).not.toHaveClass("dragged");
		});

		it("pointercancel ends the drag without reordering", async () => {
			const { items, onMove } = renderStrip();

			await press(items()[0], 30);
			await moveTo(170);
			await fireEvent.pointerCancel(window, { pointerId: 1, pointerType: "mouse" });
			await release(170);

			expect(onMove).not.toHaveBeenCalled();
			expect(items()[0]).not.toHaveClass("dragged");
		});

		it("Escape cancels the drag", async () => {
			const { items, onMove } = renderStrip();

			await press(items()[0], 30);
			await moveTo(170);
			await fireEvent.keyDown(window, { key: "Escape" });
			await release(170);

			expect(onMove).not.toHaveBeenCalled();
		});

		it("ignores other pointers and secondary buttons", async () => {
			const { items, onMove } = renderStrip();

			await press(items()[0], 30, "mouse", 2);
			await moveTo(170);
			await release(170);
			expect(onMove).not.toHaveBeenCalled();

			await press(items()[0], 30);
			await fireEvent.pointerMove(window, { pointerId: 7, pointerType: "touch", clientX: 170, clientY: 20 });
			await fireEvent.pointerUp(window, { pointerId: 7, pointerType: "touch", clientX: 170, clientY: 20 });
			expect(onMove).not.toHaveBeenCalled();
			await release(30);
		});

		it("prevents the context menu while a frame is pressed (touch long press)", async () => {
			const { items } = renderStrip();

			await press(items()[0], 30, "touch");
			const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
			items()[0].dispatchEvent(event);

			expect(event.defaultPrevented).toBe(true);
			await release(30, "touch");
		});

		describe("touch", () => {
			beforeEach(() => vi.useFakeTimers());
			afterEach(() => vi.useRealTimers());

			it("press and hold, then move, reorders", async () => {
				const { items, onMove } = renderStrip();

				await press(items()[0], 30, "touch");
				vi.advanceTimersByTime(FrameReorderGesture.LONG_PRESS_MS);
				await moveTo(170, "touch");
				expect(items()[0]).toHaveClass("dragged");
				await release(170, "touch");

				expect(onMove).toHaveBeenCalledWith("f1", 2);
			});

			it("the long press alone already lifts the frame", async () => {
				const { items } = renderStrip();

				await press(items()[1], 98, "touch");
				vi.advanceTimersByTime(FrameReorderGesture.LONG_PRESS_MS);
				await Promise.resolve();

				expect(items()[1]).toHaveClass("dragged");
				await release(98, "touch");
			});

			it("a swipe before the long press scrolls instead of dragging", async () => {
				const { items, onMove } = renderStrip();

				await press(items()[0], 30, "touch");
				await moveTo(170, "touch");
				vi.advanceTimersByTime(FrameReorderGesture.LONG_PRESS_MS);
				await release(170, "touch");

				expect(onMove).not.toHaveBeenCalled();
				expect(items()[0]).not.toHaveClass("dragged");
			});

			it("blocks the browser's touch scrolling only while dragging", async () => {
				const { items, nav } = renderStrip();
				const list = within(nav).getByRole("list");
				const touchMove = () => {
					const event = new Event("touchmove", { bubbles: true, cancelable: true });
					list.dispatchEvent(event);
					return event.defaultPrevented;
				};

				await press(items()[0], 30, "touch");
				expect(touchMove()).toBe(false);
				vi.advanceTimersByTime(FrameReorderGesture.LONG_PRESS_MS);
				expect(touchMove()).toBe(true);
				await release(30, "touch");
				expect(touchMove()).toBe(false);
			});
		});
	});

	describe("during playback", () => {
		it("marks the frame being shown (passed as active frame)", () => {
			renderStrip({ activeFrameId: "f3", playing: true });

			expect(frameButton(3)).toHaveAttribute("aria-current", "step");
			expect(frameButton(1)).not.toHaveAttribute("aria-current");
		});

		it("disables adding, deleting and moving frames", () => {
			const { nav } = renderStrip({ activeFrameId: "f2", playing: true });

			for (const name of ["Move frame left", "Move frame right", "Add frame", "Delete frame"]) {
				expect(within(nav).getByRole("button", { name })).toBeDisabled();
			}
		});

		it("reports no frame actions, also for synthetic clicks", () => {
			const { nav, onAdd, onDelete, onMove } = renderStrip({ activeFrameId: "f2", playing: true });

			for (const name of ["Move frame left", "Move frame right", "Add frame", "Delete frame"]) {
				within(nav).getByRole("button", { name }).click();
			}

			expect(onAdd).not.toHaveBeenCalled();
			expect(onDelete).not.toHaveBeenCalled();
			expect(onMove).not.toHaveBeenCalled();
		});

		it("a tap on a frame is still reported", async () => {
			const { onSelect } = renderStrip({ playing: true });

			await fireEvent.click(frameButton(3));

			expect(onSelect).toHaveBeenCalledWith("f3");
		});

		it("frames can't be reordered by dragging", async () => {
			const { items, onMove, onSelect } = renderStrip({ playing: true });

			await press(items()[0], 30);
			await moveTo(200);
			await release(200);

			expect(onMove).not.toHaveBeenCalled();
			expect(items()[0].style.transform).toBe("");
			expect(onSelect).not.toHaveBeenCalled();
		});
	});

	describe("read-only (a situation the user may only view)", () => {
		it("disables and ignores every frame action but still reports a tap on a frame", async () => {
			const { nav, onAdd, onDelete, onMove, onSelect } = renderStrip({ activeFrameId: "f2", readonly: true });

			for (const name of ["Move frame left", "Move frame right", "Add frame", "Delete frame"]) {
				const button = within(nav).getByRole("button", { name });
				expect(button).toBeDisabled();
				button.click();
			}
			await fireEvent.click(frameButton(3));

			expect(onAdd).not.toHaveBeenCalled();
			expect(onDelete).not.toHaveBeenCalled();
			expect(onMove).not.toHaveBeenCalled();
			expect(onSelect).toHaveBeenCalledWith("f3");
		});
	});
});
