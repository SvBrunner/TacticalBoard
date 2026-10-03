import { describe, it, expect } from "vitest";
import { FrameReorderGesture, type PointerKind, type Slot } from "./FrameReorderGesture";

/** Four 60 px items with 8 px gaps: centers at 30, 98, 166, 234. */
const SLOTS: Slot[] = [
	{ start: 0, end: 60 },
	{ start: 68, end: 128 },
	{ start: 136, end: 196 },
	{ start: 204, end: 264 },
];

function gesture(from = 0, kind: PointerKind = "mouse", start = { x: SLOTS[from].start + 30, y: 20 }) {
	return new FrameReorderGesture(from, SLOTS, start, kind);
}

describe("FrameReorderGesture", () => {
	it("starts pending, not dragging, at its own index", () => {
		const g = gesture(1);

		expect(g.phase).toBe("pending");
		expect(g.isActive).toBe(true);
		expect(g.isDragging).toBe(false);
		expect(g.didDrag).toBe(false);
		expect(g.targetIndex).toBe(1);
		expect(g.offset).toBe(0);
	});

	it.each([[-1], [4], [1.5]])("rejects the start index %d", (from) => {
		expect(() => new FrameReorderGesture(from, SLOTS, { x: 0, y: 0 }, "mouse")).toThrow(/outside/);
	});

	describe("mouse and pen", () => {
		it.each([["mouse"], ["pen"]] as const)("%s: a movement within the threshold stays a tap", (kind) => {
			const g = gesture(0, kind);

			g.move({ x: 30 + 5, y: 20 + 5 });

			expect(g.phase).toBe("pending");
			expect(g.release()).toBeNull();
			expect(g.didDrag).toBe(false);
			expect(g.phase).toBe("finished");
		});

		it.each([["mouse"], ["pen"]] as const)("%s: moving beyond the threshold starts a drag", (kind) => {
			const g = gesture(0, kind);

			g.move({ x: 30 + FrameReorderGesture.DRAG_THRESHOLD_PX + 1, y: 20 });

			expect(g.isDragging).toBe(true);
			expect(g.didDrag).toBe(true);
			expect(g.offset).toBe(FrameReorderGesture.DRAG_THRESHOLD_PX + 1);
		});

		it("counts vertical movement for the threshold too", () => {
			const g = gesture(0);

			g.move({ x: 30, y: 40 });

			expect(g.isDragging).toBe(true);
		});

		it("holdElapsed does nothing for a mouse", () => {
			const g = gesture(0);

			g.holdElapsed();

			expect(g.phase).toBe("pending");
		});
	});

	describe("touch", () => {
		it("moving before the long press is a scroll and cancels the gesture", () => {
			const g = gesture(0, "touch");

			g.move({ x: 60, y: 20 });

			expect(g.phase).toBe("cancelled");
			expect(g.isActive).toBe(false);
			g.holdElapsed();
			expect(g.isDragging).toBe(false);
			expect(g.release()).toBeNull();
		});

		it("small jitter before the long press is fine", () => {
			const g = gesture(0, "touch");

			g.move({ x: 33, y: 22 });
			g.holdElapsed();

			expect(g.isDragging).toBe(true);
		});

		it("the long press starts the drag; moving then reorders", () => {
			const g = gesture(0, "touch");

			g.holdElapsed();
			g.move({ x: 30 + 140, y: 20 });

			expect(g.targetIndex).toBe(2);
			expect(g.release()).toEqual({ from: 0, to: 2 });
		});
	});

	describe("target index", () => {
		function dragBy(from: number, dx: number) {
			const g = gesture(from);
			g.move({ x: SLOTS[from].start + 30 + dx, y: 20 });
			return g;
		}

		it.each([
			// from, dx, expected target
			[0, 20, 0],
			[0, 69, 1],
			[0, 137, 2],
			[0, 500, 3],
			[3, -20, 3],
			[3, -69, 2],
			[3, -205, 0],
			[3, -500, 0],
			[1, 69, 2],
			[1, -69, 0],
		])("from %i dragged by %i → %i", (from, dx, expected) => {
			expect(dragBy(from, dx).targetIndex).toBe(expected);
		});

		it("uses the dragged item's center, not the pointer's spot on it", () => {
			// Grabbed at the item's left edge; moving the item's center past the next center.
			const g = gesture(0, "mouse", { x: 2, y: 20 });

			g.move({ x: 2 + 69, y: 20 });

			expect(g.targetIndex).toBe(1);
		});

		it("release reports the reorder, or null when it ends where it started", () => {
			expect(dragBy(0, 137).release()).toEqual({ from: 0, to: 2 });
			expect(dragBy(2, -137).release()).toEqual({ from: 2, to: 0 });
			const back = dragBy(1, 20);
			expect(back.release()).toBeNull();
			expect(back.didDrag).toBe(true);
		});
	});

	describe("cancel", () => {
		it("ends a drag without a reorder and ignores further input", () => {
			const g = gesture(0);
			g.move({ x: 200, y: 20 });

			g.cancel();

			expect(g.phase).toBe("cancelled");
			expect(g.offset).toBe(0);
			expect(g.targetIndex).toBe(0);
			g.move({ x: 250, y: 20 });
			expect(g.isDragging).toBe(false);
			expect(g.release()).toBeNull();
			expect(g.phase).toBe("cancelled");
		});

		it("after release the gesture is finished and stays so", () => {
			const g = gesture(0);
			g.release();

			g.cancel();
			g.move({ x: 300, y: 20 });

			expect(g.phase).toBe("finished");
		});
	});

	describe("shiftFor", () => {
		it("is 0 for every item while not dragging", () => {
			const g = gesture(0);

			expect(SLOTS.map((_, i) => g.shiftFor(i))).toEqual([0, 0, 0, 0]);
		});

		it("moves the items between start and target back by one item plus gap when dragging forward", () => {
			const g = gesture(0);
			g.move({ x: 30 + 137, y: 20 });

			expect(SLOTS.map((_, i) => g.shiftFor(i))).toEqual([0, -68, -68, 0]);
		});

		it("moves the items between target and start forward when dragging backward", () => {
			const g = gesture(3);
			g.move({ x: 234 - 137, y: 20 });

			expect(SLOTS.map((_, i) => g.shiftFor(i))).toEqual([0, 68, 68, 0]);
		});

		it("works with a single item", () => {
			const g = new FrameReorderGesture(0, [{ start: 0, end: 50 }], { x: 25, y: 0 }, "mouse");
			g.move({ x: 100, y: 0 });

			expect(g.targetIndex).toBe(0);
			expect(g.shiftFor(0)).toBe(0);
			expect(g.release()).toBeNull();
		});
	});

	describe("autoScrollStep", () => {
		it("is 0 away from the edges", () => {
			expect(FrameReorderGesture.autoScrollStep(200, 0, 400)).toBe(0);
		});

		it("scrolls back near the start and forward near the end, faster closer to the edge", () => {
			const max = FrameReorderGesture.AUTO_SCROLL_MAX_STEP_PX;

			expect(FrameReorderGesture.autoScrollStep(0, 0, 400)).toBe(-max);
			expect(FrameReorderGesture.autoScrollStep(20, 0, 400)).toBe(-max / 2);
			expect(FrameReorderGesture.autoScrollStep(380, 0, 400)).toBe(max / 2);
			expect(FrameReorderGesture.autoScrollStep(400, 0, 400)).toBe(max);
		});

		it("is capped beyond the edges", () => {
			const max = FrameReorderGesture.AUTO_SCROLL_MAX_STEP_PX;

			expect(FrameReorderGesture.autoScrollStep(-100, 0, 400)).toBe(-max);
			expect(FrameReorderGesture.autoScrollStep(900, 0, 400)).toBe(max);
		});

		it("uses a smaller zone for a narrow strip and is 0 for an empty one", () => {
			expect(FrameReorderGesture.autoScrollStep(30, 0, 100)).toBe(0);
			expect(FrameReorderGesture.autoScrollStep(10, 0, 100)).toBeLessThan(0);
			expect(FrameReorderGesture.autoScrollStep(0, 0, 0)).toBe(0);
		});
	});
});
