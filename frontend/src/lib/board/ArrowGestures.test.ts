import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { ArrowGestures, type GesturePoint } from "./ArrowGestures";
import { BoardViewport } from "./BoardViewport";

/** Scale 0.5 CSS px per scene unit: screen = scene / 2. */
const SCALE = 0.5;

function at(x: number, y: number, pointerId = 1): GesturePoint {
	return { pointerId, scene: { x, y }, screen: { x: x * SCALE, y: y * SCALE }, scale: SCALE };
}

describe("ArrowGestures", () => {
	let gestures: ArrowGestures;

	beforeEach(() => {
		gestures = new ArrowGestures({ clamp: (point) => new BoardViewport().clamp(point) });
	});

	const draft = () => get(gestures.draft);

	it("is idle without a preview at first", () => {
		expect(gestures.isActive).toBe(false);
		expect(draft()).toBeNull();
	});

	describe("press and drag", () => {
		it("draws from the press point to the release point", () => {
			gestures.down(at(100, 100), null);
			gestures.move(at(300, 200));

			expect(draft()).toEqual({ start: { x: 100, y: 100 }, end: { x: 300, y: 200 } });
			expect(gestures.up(at(400, 200))).toEqual({ kind: "created", start: { x: 100, y: 100 }, end: { x: 400, y: 200 } });
			expect(draft()).toBeNull();
			expect(gestures.isActive).toBe(false);
		});

		it("only becomes a drag after the pointer moved the threshold (6 CSS px)", () => {
			gestures.down(at(100, 100), null);

			gestures.move(at(110, 100)); // 5 CSS px
			expect(draft()).toBeNull();

			gestures.move(at(112, 100)); // 6 CSS px
			expect(draft()).toEqual({ start: { x: 100, y: 100 }, end: { x: 112, y: 100 } });
		});

		it("stays a drag when the pointer comes back near the press point", () => {
			gestures.down(at(100, 100), null);
			gestures.move(at(300, 100));
			gestures.move(at(102, 100));

			expect(gestures.up(at(102, 100))).toEqual({ kind: "discarded" });
		});

		it("a press on an element starts an arrow there", () => {
			gestures.down(at(500, 500), "player-1");
			gestures.move(at(700, 500));

			expect(gestures.up(at(800, 500))).toEqual({ kind: "created", start: { x: 500, y: 500 }, end: { x: 800, y: 500 } });
		});

		it("discards arrows shorter than 24 CSS px", () => {
			gestures.down(at(100, 100), null);
			gestures.move(at(146, 100)); // 23 CSS px

			expect(gestures.up(at(146, 100))).toEqual({ kind: "discarded" });
		});

		it("keeps an arrow of exactly the minimum length", () => {
			gestures.down(at(100, 100), null);
			gestures.move(at(148, 100)); // 24 CSS px

			expect(gestures.up(at(148, 100)).kind).toBe("created");
		});

		it("measures the minimum length on screen, at the current scale", () => {
			gestures.down(at(100, 100), null);
			gestures.move(at(130, 100));

			// 30 scene units at scale 1 = 30 CSS px: long enough.
			expect(gestures.up({ pointerId: 1, scene: { x: 130, y: 100 }, screen: { x: 130, y: 100 }, scale: 1 }).kind).toBe(
				"created",
			);
		});

		it("clamps start, preview and end to the visible area", () => {
			gestures.down(at(-50, 100), null);
			gestures.move(at(2300, -40));

			expect(draft()).toEqual({ start: { x: 0, y: 100 }, end: { x: 2000, y: 0 } });
			expect(gestures.up(at(2300, 1200))).toEqual({ kind: "created", start: { x: 0, y: 100 }, end: { x: 2000, y: 1000 } });
		});

		it("works on the half field: clamps into the visible half", () => {
			const half = new ArrowGestures({ clamp: (point) => new BoardViewport(undefined, "half").clamp(point) });

			half.down(at(500, 500), null);
			half.move(at(1500, 500));

			expect(half.up(at(1500, 500))).toEqual({ kind: "created", start: { x: 1000, y: 500 }, end: { x: 1500, y: 500 } });
		});

		it("ignores moves and releases of other pointers", () => {
			gestures.down(at(100, 100, 1), null);
			gestures.move(at(400, 400, 2));

			expect(draft()).toBeNull();
			expect(gestures.up(at(400, 400, 2))).toEqual({ kind: "none" });
			expect(gestures.isActive).toBe(true);
		});
	});

	describe("tap, tap", () => {
		it("a tap on the empty field sets the start point and shows a start marker", () => {
			gestures.down(at(100, 100), null);

			expect(gestures.up(at(102, 100))).toEqual({ kind: "startPlaced", start: { x: 100, y: 100 } });
			expect(draft()).toEqual({ start: { x: 100, y: 100 }, end: null });
			expect(gestures.isActive).toBe(true);
		});

		it("the second tap sets the end point", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));

			gestures.down(at(600, 300), null);

			expect(gestures.up(at(600, 300))).toEqual({ kind: "created", start: { x: 100, y: 100 }, end: { x: 600, y: 300 } });
			expect(draft()).toBeNull();
			expect(gestures.isActive).toBe(false);
		});

		it("the preview follows a hovering pointer while the start is pending", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));

			gestures.move(at(400, 250, 7));

			expect(draft()).toEqual({ start: { x: 100, y: 100 }, end: { x: 400, y: 250 } });
		});

		it("with a start pending, the second tap ends the arrow even on an element", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));

			gestures.down(at(500, 500), "player-1");

			expect(gestures.up(at(500, 500))).toEqual({ kind: "created", start: { x: 100, y: 100 }, end: { x: 500, y: 500 } });
		});

		it("with a start pending, a drag ends the arrow where it is released (the preview follows it)", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));

			gestures.down(at(500, 100), null);
			gestures.move(at(600, 100));
			expect(draft()).toEqual({ start: { x: 100, y: 100 }, end: { x: 600, y: 100 } });

			expect(gestures.up(at(700, 100))).toEqual({ kind: "created", start: { x: 100, y: 100 }, end: { x: 700, y: 100 } });
		});

		it("a second tap next to the start discards the arrow", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));
			gestures.down(at(110, 100), null);

			expect(gestures.up(at(110, 100))).toEqual({ kind: "discarded" });
			expect(gestures.isActive).toBe(false);
			expect(draft()).toBeNull();
		});

		it("a tap on an element without a pending start means the element", () => {
			gestures.down(at(500, 500), "player-1");

			expect(gestures.up(at(501, 500))).toEqual({ kind: "tapElement", elementId: "player-1" });
			expect(gestures.isActive).toBe(false);
			expect(draft()).toBeNull();
		});
	});

	describe("cancelling", () => {
		it("cancel drops a drag in progress", () => {
			gestures.down(at(100, 100), null);
			gestures.move(at(300, 100));

			expect(gestures.cancel()).toBe(true);

			expect(draft()).toBeNull();
			expect(gestures.up(at(400, 100))).toEqual({ kind: "none" });
		});

		it("cancel drops a pending start", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));

			expect(gestures.cancel()).toBe(true);

			expect(draft()).toBeNull();
			gestures.down(at(600, 100), null);
			expect(gestures.up(at(600, 100))).toEqual({ kind: "startPlaced", start: { x: 600, y: 100 } });
		});

		it("cancel reports when there was nothing to cancel", () => {
			expect(gestures.cancel()).toBe(false);
		});

		it("a second pointer going down cancels the drawing", () => {
			gestures.down(at(100, 100, 1), null);
			gestures.move(at(300, 100, 1));

			gestures.down(at(800, 800, 2), null);

			expect(draft()).toBeNull();
			expect(gestures.isActive).toBe(false);
			expect(gestures.up(at(300, 100, 1))).toEqual({ kind: "none" });
			expect(gestures.up(at(800, 800, 2))).toEqual({ kind: "none" });
		});

		it("a second pointer also drops a pending start", () => {
			gestures.down(at(100, 100), null);
			gestures.up(at(100, 100));
			gestures.down(at(500, 100, 1), null);

			gestures.down(at(600, 100, 2), null);

			expect(gestures.isActive).toBe(false);
		});
	});

	it("uses custom thresholds", () => {
		const strict = new ArrowGestures({ clamp: (point) => point, dragThresholdPx: 20, minLengthPx: 100 });

		strict.down(at(0, 0), null);
		strict.move(at(30, 0)); // 15 CSS px: still a press
		expect(get(strict.draft)).toBeNull();
		strict.move(at(100, 0)); // 50 CSS px: a drag
		expect(strict.up(at(100, 0))).toEqual({ kind: "discarded" });
	});
});
