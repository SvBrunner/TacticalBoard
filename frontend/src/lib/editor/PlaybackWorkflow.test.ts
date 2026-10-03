import { describe, it, expect, beforeEach, vi } from "vitest";
import { get, writable } from "svelte/store";
import { FakeScheduler } from "$lib/testing/FakeScheduler";
import { PlaybackTimeline } from "$lib/playback/PlaybackTimeline";
import { SlideshowPlayer } from "$lib/playback/SlideshowPlayer";
import { PlaybackWorkflow } from "./PlaybackWorkflow";

describe("PlaybackWorkflow", () => {
	let frames: { id: string }[];
	let scheduler: FakeScheduler;
	let player: SlideshowPlayer;
	let situation: ReturnType<typeof writable<object>>;
	let beforeStart: ReturnType<typeof vi.fn<() => void>>;
	let log: { notify: ReturnType<typeof vi.fn<(message: string) => void>> };
	let workflow: PlaybackWorkflow;

	const status = () => get(player.state).status;
	const shown = () => player.displayedFrameId("active");

	beforeEach(() => {
		frames = [{ id: "f1" }, { id: "f2" }, { id: "f3" }];
		scheduler = new FakeScheduler();
		player = new SlideshowPlayer(
			{ timeline: () => PlaybackTimeline.of(frames, { frameDurationMs: 1000 }), loop: () => false },
			scheduler,
		);
		situation = writable<object>({ id: "s1" });
		beforeStart = vi.fn<() => void>();
		log = { notify: vi.fn<(message: string) => void>() };
		workflow = new PlaybackWorkflow({ player, situation, beforeStart, log });
	});

	describe("play", () => {
		it("leaves editing first, then plays from frame 1", () => {
			beforeStart.mockImplementation(() => expect(status()).toBe("stopped"));

			workflow.play();

			expect(beforeStart).toHaveBeenCalledOnce();
			expect(status()).toBe("playing");
			expect(shown()).toBe("f1");
			expect(log.notify).toHaveBeenCalledWith("Playback started");
		});

		it("does nothing with a single frame (and doesn't leave editing)", () => {
			frames = [{ id: "only" }];

			workflow.play();
			workflow.toggle();

			expect(beforeStart).not.toHaveBeenCalled();
			expect(status()).toBe("stopped");
			expect(workflow.canPlay()).toBe(false);
		});

		it("resumes when paused without leaving editing again", () => {
			workflow.play();
			workflow.pause();

			workflow.play();

			expect(status()).toBe("playing");
			expect(beforeStart).toHaveBeenCalledOnce();
		});
	});

	it("toggle starts, pauses and resumes", () => {
		workflow.toggle();
		expect(status()).toBe("playing");
		workflow.toggle();
		expect(status()).toBe("paused");
		workflow.toggle();
		expect(status()).toBe("playing");
		expect(beforeStart).toHaveBeenCalledOnce();
	});

	it("stop ends playback and logs it; stopping while stopped logs nothing", () => {
		workflow.stop();
		expect(log.notify).not.toHaveBeenCalled();

		workflow.play();
		workflow.stop();

		expect(status()).toBe("stopped");
		expect(workflow.isActive()).toBe(false);
		expect(log.notify).toHaveBeenLastCalledWith("Playback stopped");
	});

	it("next, previous and showFrame move through the slideshow", () => {
		workflow.play();

		workflow.next();
		expect(shown()).toBe("f2");
		workflow.showFrame(2);
		expect(shown()).toBe("f3");
		workflow.previous();
		expect(shown()).toBe("f2");
	});

	describe("the situation changes", () => {
		it("stops playback when the situation is replaced (import, new, close)", () => {
			workflow.play();

			situation.set({ id: "s2" });

			expect(status()).toBe("stopped");
			expect(log.notify).toHaveBeenLastCalledWith("Playback stopped: the situation changed");
		});

		it("keeps playing when the store re-emits the same situation (e.g. after an export)", () => {
			workflow.play();

			situation.update((same) => same);

			expect(status()).toBe("playing");
		});

		it("changes while stopped don't matter", () => {
			situation.set({ id: "s2" });

			expect(status()).toBe("stopped");
			expect(log.notify).not.toHaveBeenCalled();
		});
	});

	it("destroy stops playback and the subscription", () => {
		workflow.play();

		workflow.destroy();
		expect(status()).toBe("stopped");

		workflow.play();
		situation.set({ id: "s2" });
		expect(status()).toBe("playing");
	});
});
