import { describe, it, expect } from "vitest";
import { PopoverPlacement } from "./PopoverPlacement";

const viewport = { width: 1000, height: 800 };
const popover = { width: 200, height: 300 };

describe("PopoverPlacement", () => {
	const placement = new PopoverPlacement(8, 8);

	it("places the popover below the anchor, horizontally centered", () => {
		const result = placement.place({ x: 400, y: 100, width: 40, height: 40 }, popover, viewport);

		expect(result).toEqual({ x: 320, y: 148, side: "below" });
	});

	it("flips above the anchor when there is no room below", () => {
		const result = placement.place({ x: 400, y: 600, width: 40, height: 40 }, popover, viewport);

		expect(result).toEqual({ x: 320, y: 292, side: "above" });
	});

	it("stays below when it fits exactly", () => {
		// below = 484 + 8 = 492; 492 + 300 = 792 = 800 - margin
		const result = placement.place({ x: 400, y: 444, width: 40, height: 40 }, popover, viewport);

		expect(result.side).toBe("below");
	});

	it("clamps to the left edge", () => {
		const result = placement.place({ x: 0, y: 100, width: 20, height: 20 }, popover, viewport);

		expect(result.x).toBe(8);
	});

	it("clamps to the right edge", () => {
		const result = placement.place({ x: 990, y: 100, width: 20, height: 20 }, popover, viewport);

		expect(result.x).toBe(1000 - 200 - 8);
	});

	it("pins to the margin when the popover is wider than the viewport", () => {
		const result = placement.place({ x: 50, y: 10, width: 20, height: 20 }, { width: 400, height: 100 }, { width: 300, height: 800 });

		expect(result.x).toBe(8);
	});

	describe("when it fits neither below nor above", () => {
		const short = { width: 1000, height: 400 };

		it("goes to the right of the anchor, vertically centered, without covering it", () => {
			const result = placement.place({ x: 300, y: 150, width: 200, height: 100 }, popover, short);

			expect(result).toEqual({ x: 508, y: 50, side: "right" });
		});

		it("goes to the left when there is no room on the right", () => {
			const result = placement.place({ x: 600, y: 150, width: 200, height: 100 }, popover, short);

			expect(result).toEqual({ x: 392, y: 50, side: "left" });
		});

		it("keeps a side placement inside the viewport vertically", () => {
			const result = placement.place({ x: 300, y: 200, width: 100, height: 190 }, popover, short);

			expect(result.side).toBe("right");
			expect(result.y).toBe(400 - 300 - 8);
		});
	});

	it("uses the roomier of below/above and keeps it on screen when it fits on no side", () => {
		const small = { width: 300, height: 400 };

		const nearTop = placement.place({ x: 130, y: 100, width: 40, height: 40 }, popover, small);
		const nearBottom = placement.place({ x: 130, y: 260, width: 40, height: 40 }, popover, small);

		expect(nearTop.side).toBe("below");
		expect(nearTop.y).toBe(400 - 300 - 8);
		expect(nearBottom.side).toBe("above");
		expect(nearBottom.y).toBe(8);
	});

	it("uses default gap and margin", () => {
		const result = new PopoverPlacement().place({ x: 400, y: 100, width: 40, height: 40 }, popover, viewport);

		expect(result).toEqual({ x: 320, y: 148, side: "below" });
	});
});
