import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { FakeScheduler } from "$lib/testing/FakeScheduler";
import { PlaybackTimeline } from "./PlaybackTimeline";
import { SlideshowPlayer, type PlaybackState } from "./SlideshowPlayer";

/** A source whose frames, duration and loop setting the test can change. */
class TestSource {
	frames = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];
	frameDurationMs = 2000;
	looping = false;

	timeline(): PlaybackTimeline {
		return PlaybackTimeline.of(this.frames, { frameDurationMs: this.frameDurationMs });
	}

	loop(): boolean {
		return this.looping;
	}
}

describe("SlideshowPlayer", () => {
	let source: TestSource;
	let scheduler: FakeScheduler;
	let player: SlideshowPlayer;

	const state = (): PlaybackState => get(player.state);
	const shown = () => {
		const current = state();
		return current.status === "stopped" ? null : current.frameId;
	};

	beforeEach(() => {
		source = new TestSource();
		scheduler = new FakeScheduler();
		player = new SlideshowPlayer(source, scheduler);
	});

	it("starts stopped and shows the active frame", () => {
		expect(state()).toEqual({ status: "stopped" });
		expect(player.isActive()).toBe(false);
		expect(player.displayedFrameId("f2")).toBe("f2");
	});

	describe("play", () => {
		it("starts at frame 1, whatever frame is active", () => {
			player.play();

			expect(state()).toEqual({ status: "playing", index: 0, frameId: "f1", frameCount: 3 });
			expect(player.isActive()).toBe(true);
			expect(player.displayedFrameId("f3")).toBe("f1");
		});

		it("advances to the next frame when the frame duration has passed", () => {
			player.play();

			scheduler.advance(1999);
			expect(shown()).toBe("f1");
			scheduler.advance(1);
			expect(shown()).toBe("f2");
			scheduler.advance(2000);
			expect(shown()).toBe("f3");
		});

		it("uses the current frame duration for each new frame", () => {
			player.play();
			source.frameDurationMs = 5000;

			scheduler.advance(2000);
			expect(shown()).toBe("f2");
			scheduler.advance(4999);
			expect(shown()).toBe("f2");
			scheduler.advance(1);
			expect(shown()).toBe("f3");
		});

		it("does nothing while already playing", () => {
			player.play();
			scheduler.advance(1500);

			player.play();
			scheduler.advance(500);

			expect(shown()).toBe("f2");
			expect(scheduler.pending).toBe(1);
		});

		it("is not possible with a single frame", () => {
			source.frames = [{ id: "only" }];

			expect(player.canPlay()).toBe(false);
			player.play();
			player.toggle();

			expect(state()).toEqual({ status: "stopped" });
			expect(scheduler.pending).toBe(0);
		});

		it("is possible with two frames", () => {
			source.frames = [{ id: "a" }, { id: "b" }];

			expect(player.canPlay()).toBe(true);
		});
	});

	describe("the end", () => {
		it("stops after the last frame without loop; the previously active frame is shown again", () => {
			player.play();

			scheduler.advance(6000);

			expect(state()).toEqual({ status: "stopped" });
			expect(player.displayedFrameId("f2")).toBe("f2");
			expect(scheduler.pending).toBe(0);
		});

		it("starts over at frame 1 with loop on", () => {
			source.looping = true;
			player.play();

			scheduler.advance(6000);
			expect(state()).toMatchObject({ status: "playing", index: 0, frameId: "f1" });
			scheduler.advance(2000);
			expect(shown()).toBe("f2");
		});

		it("reads the loop setting at the end, so turning it on during playback counts", () => {
			player.play();
			scheduler.advance(4000);

			source.looping = true;
			scheduler.advance(2000);

			expect(shown()).toBe("f1");
		});

		it("stops when the frames went down to one meanwhile", () => {
			source.looping = true;
			player.play();
			source.frames = [{ id: "f1" }];

			scheduler.advance(2000);

			expect(state()).toEqual({ status: "stopped" });
		});
	});

	describe("pause and resume", () => {
		it("pausing keeps the frame and stops the clock", () => {
			player.play();
			scheduler.advance(500);

			player.pause();
			scheduler.advance(60000);

			expect(state()).toEqual({ status: "paused", index: 0, frameId: "f1", frameCount: 3 });
			expect(scheduler.pending).toBe(0);
		});

		it("resuming continues with the time the frame had left", () => {
			player.play();
			scheduler.advance(500);
			player.pause();
			scheduler.advance(10000);

			player.resume();
			scheduler.advance(1499);
			expect(shown()).toBe("f1");
			scheduler.advance(1);
			expect(shown()).toBe("f2");
		});

		it("play resumes a paused slideshow instead of starting over", () => {
			player.play();
			scheduler.advance(2500);
			player.pause();

			player.play();

			expect(state()).toMatchObject({ status: "playing", frameId: "f2" });
			scheduler.advance(1500);
			expect(shown()).toBe("f3");
		});

		it("toggle plays, pauses and resumes", () => {
			player.toggle();
			expect(state().status).toBe("playing");
			player.toggle();
			expect(state().status).toBe("paused");
			player.toggle();
			expect(state().status).toBe("playing");
		});

		it("pause and resume do nothing when they don't apply", () => {
			player.pause();
			player.resume();
			expect(state()).toEqual({ status: "stopped" });

			player.play();
			player.resume();
			expect(state().status).toBe("playing");
		});
	});

	describe("stop", () => {
		it("cancels the timer and shows the previously active frame again", () => {
			player.play();
			scheduler.advance(2500);

			player.stop();

			expect(state()).toEqual({ status: "stopped" });
			expect(scheduler.pending).toBe(0);
			expect(player.displayedFrameId("f3")).toBe("f3");
			scheduler.advance(10000);
			expect(state()).toEqual({ status: "stopped" });
		});

		it("works while paused", () => {
			player.play();
			player.pause();

			player.stop();

			expect(state()).toEqual({ status: "stopped" });
		});

		it("playing again after a stop starts at frame 1", () => {
			player.play();
			scheduler.advance(4000);
			player.stop();

			player.play();

			expect(shown()).toBe("f1");
		});

		it("does nothing while stopped", () => {
			const seen: PlaybackState[] = [];
			const unsubscribe = player.state.subscribe((value) => seen.push(value));

			player.stop();
			unsubscribe();

			expect(seen).toHaveLength(1);
		});
	});

	describe("previous / next / seek", () => {
		it("next and previous show the neighbouring frame for its full duration", () => {
			player.play();
			scheduler.advance(1500);

			player.next();
			expect(shown()).toBe("f2");
			scheduler.advance(1999);
			expect(shown()).toBe("f2");
			scheduler.advance(1);
			expect(shown()).toBe("f3");

			player.previous();
			expect(shown()).toBe("f2");
			expect(scheduler.pending).toBe(1);
		});

		it("clamp at the first and the last frame (also with loop on)", () => {
			source.looping = true;
			player.play();

			player.previous();
			expect(state()).toMatchObject({ index: 0 });

			player.next();
			player.next();
			player.next();
			expect(state()).toMatchObject({ index: 2 });
		});

		it("clamping doesn't restart the shown frame's time", () => {
			player.play();
			scheduler.advance(1500);

			player.previous();
			scheduler.advance(500);

			expect(shown()).toBe("f2");
		});

		it("stay paused while paused; resuming gives the new frame its full duration", () => {
			player.play();
			scheduler.advance(1500);
			player.pause();

			player.next();
			expect(state()).toMatchObject({ status: "paused", frameId: "f2" });
			expect(scheduler.pending).toBe(0);

			player.resume();
			scheduler.advance(1999);
			expect(shown()).toBe("f2");
			scheduler.advance(1);
			expect(shown()).toBe("f3");
		});

		it("seek shows any frame, clamped to the frames", () => {
			player.play();

			player.seek(2);
			expect(shown()).toBe("f3");
			player.seek(-5);
			expect(shown()).toBe("f1");
			player.seek(99);
			expect(shown()).toBe("f3");
			player.seek(Number.NaN);
			expect(shown()).toBe("f3");
		});

		it("are ignored while stopped", () => {
			player.next();
			player.previous();
			player.seek(1);

			expect(state()).toEqual({ status: "stopped" });
			expect(scheduler.pending).toBe(0);
		});
	});
});
