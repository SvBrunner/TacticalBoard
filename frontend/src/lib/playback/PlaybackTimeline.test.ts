import { describe, it, expect } from "vitest";
import { PlaybackTimeline } from "./PlaybackTimeline";

const frames = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("PlaybackTimeline", () => {
	it("lays the frames out back to back, in order, each for the frame duration", () => {
		const timeline = PlaybackTimeline.of(frames, { frameDurationMs: 2000 });

		expect(timeline.entries).toEqual([
			{ frameId: "a", index: 0, startMs: 0, durationMs: 2000 },
			{ frameId: "b", index: 1, startMs: 2000, durationMs: 2000 },
			{ frameId: "c", index: 2, startMs: 4000, durationMs: 2000 },
		]);
		expect(timeline.frameCount).toBe(3);
	});

	it("totals the frame durations", () => {
		expect(PlaybackTimeline.of(frames, { frameDurationMs: 2000 }).totalMs).toBe(6000);
		expect(PlaybackTimeline.of(frames, { frameDurationMs: 5000 }).totalMs).toBe(15000);
	});

	it("has a single entry for a single frame", () => {
		const timeline = PlaybackTimeline.of([{ id: "only" }], { frameDurationMs: 1000 });

		expect(timeline.entries).toEqual([{ frameId: "only", index: 0, startMs: 0, durationMs: 1000 }]);
		expect(timeline.totalMs).toBe(1000);
		expect(timeline.frameAt(0)?.frameId).toBe("only");
		expect(timeline.frameAt(5000)?.frameId).toBe("only");
	});

	it("is empty without frames", () => {
		const timeline = PlaybackTimeline.of([], { frameDurationMs: 1000 });

		expect(timeline.entries).toEqual([]);
		expect(timeline.totalMs).toBe(0);
		expect(timeline.frameAt(0)).toBeUndefined();
	});

	it.each([[0], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])("rejects the frame duration %s", (duration) => {
		expect(() => PlaybackTimeline.of(frames, { frameDurationMs: duration })).toThrow(/positive/);
	});

	describe("frameAt", () => {
		const timeline = PlaybackTimeline.of(frames, { frameDurationMs: 2000 });

		it.each([
			[0, "a"],
			[1999, "a"],
			[2000, "b"],
			[3999.5, "b"],
			[4000, "c"],
			[5999, "c"],
		])("at %s ms shows frame %s (a boundary belongs to the next frame)", (ms, id) => {
			expect(timeline.frameAt(ms)?.frameId).toBe(id);
		});

		it("gives the first frame before the start and the last one at or after the end", () => {
			expect(timeline.frameAt(-100)?.frameId).toBe("a");
			expect(timeline.frameAt(6000)?.frameId).toBe("c");
			expect(timeline.frameAt(60000)?.frameId).toBe("c");
		});
	});

	describe("entryAt", () => {
		const timeline = PlaybackTimeline.of(frames, { frameDurationMs: 1000 });

		it("returns the entry at a position", () => {
			expect(timeline.entryAt(1)).toEqual({ frameId: "b", index: 1, startMs: 1000, durationMs: 1000 });
		});

		it.each([[-1], [3], [0.5]])("returns undefined for position %s", (index) => {
			expect(timeline.entryAt(index)).toBeUndefined();
		});
	});
});
