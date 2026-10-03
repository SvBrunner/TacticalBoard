import { get, writable, type Readable, type Writable } from "svelte/store";
import type { PlaybackTimeline } from "./PlaybackTimeline";
import { TimeoutScheduler, type Cancel, type Scheduler } from "./Scheduler";

export type PlaybackStatus = "stopped" | "playing" | "paused";

/** Stopped, or which frame the slideshow shows. */
export type PlaybackState =
	| { readonly status: "stopped" }
	| {
			readonly status: "playing" | "paused";
			/** 0-based position of the shown frame. */
			readonly index: number;
			readonly frameId: string;
			readonly frameCount: number;
	  };

/** Where the player gets the frames and settings from; read whenever they matter, so changes apply right away. */
export interface PlaybackSource {
	/** The frames to play and their durations. */
	timeline(): PlaybackTimeline;
	/** Whether to start over at frame 1 after the last frame (instead of stopping). */
	loop(): boolean;
}

const STOPPED: PlaybackState = { status: "stopped" };

/**
 * The slideshow: shows the frames one after the other, each for its
 * duration on the timeline, with hard cuts. Playback always starts at
 * frame 1; after the last frame it stops, or starts over when looping.
 *
 * The player never touches the model or the active frame: it only says
 * which frame to show (`state`, `displayedFrameId`). So when playback
 * stops — by Stop or at the end — the frame that was active before
 * playback is shown again.
 *
 * Paused, the shown frame keeps the time it had left; Previous/Next/seek
 * show the new frame for its full duration. Playing needs at least two
 * frames.
 */
export class SlideshowPlayer {
	private readonly store: Writable<PlaybackState> = writable(STOPPED);
	private cancelTimer: Cancel | null = null;
	/** While playing: when the shown frame ends (scheduler time). */
	private deadline = 0;
	/** While paused: how long the shown frame still has. */
	private remainingMs = 0;

	readonly state: Readable<PlaybackState> = { subscribe: this.store.subscribe };

	constructor(
		private readonly source: PlaybackSource,
		private readonly scheduler: Scheduler = new TimeoutScheduler(),
	) {}

	current(): PlaybackState {
		return get(this.store);
	}

	/** Playing or paused (the board then shows the slideshow, read-only). */
	isActive(): boolean {
		return this.current().status !== "stopped";
	}

	/** Whether there is anything to play: at least two frames. */
	canPlay(): boolean {
		return this.source.timeline().frameCount >= 2;
	}

	/** The frame to show: the slideshow's while playing or paused, otherwise the active frame. */
	displayedFrameId(activeFrameId: string): string {
		const state = this.current();
		return state.status === "stopped" ? activeFrameId : state.frameId;
	}

	/** Starts at frame 1 when stopped (if there are at least two frames), resumes when paused. */
	play(): void {
		const state = this.current();
		if (state.status === "paused") {
			this.resume();
			return;
		}
		if (state.status === "playing") {
			return;
		}
		const timeline = this.source.timeline();
		if (timeline.frameCount < 2) {
			return;
		}
		this.show(timeline, 0, "playing");
	}

	pause(): void {
		const state = this.current();
		if (state.status !== "playing") {
			return;
		}
		this.remainingMs = Math.max(0, this.deadline - this.scheduler.now());
		this.clearTimer();
		this.store.set({ ...state, status: "paused" });
	}

	/** Continues a paused slideshow; the shown frame gets the time it had left. */
	resume(): void {
		const state = this.current();
		if (state.status !== "paused") {
			return;
		}
		this.store.set({ ...state, status: "playing" });
		this.startTimer(this.remainingMs);
	}

	/** Play/Pause: plays when stopped, pauses when playing, resumes when paused. */
	toggle(): void {
		if (this.current().status === "playing") {
			this.pause();
		} else {
			this.play();
		}
	}

	/** Ends the slideshow; the previously active frame is shown again. */
	stop(): void {
		this.clearTimer();
		if (this.isActive()) {
			this.store.set(STOPPED);
		}
	}

	/** Shows the next frame (none after the last; also when looping). Only while playing or paused. */
	next(): void {
		const state = this.current();
		if (state.status !== "stopped") {
			this.seek(state.index + 1);
		}
	}

	/** Shows the previous frame (none before the first). Only while playing or paused. */
	previous(): void {
		const state = this.current();
		if (state.status !== "stopped") {
			this.seek(state.index - 1);
		}
	}

	/**
	 * Shows the frame at `index` (clamped to the frames) for its full
	 * duration, staying playing or paused. Ignored while stopped and for
	 * the frame already shown.
	 */
	seek(index: number): void {
		const state = this.current();
		if (state.status === "stopped" || !Number.isFinite(index)) {
			return;
		}
		const timeline = this.source.timeline();
		const target = Math.min(Math.max(Math.trunc(index), 0), timeline.frameCount - 1);
		if (target === state.index || target < 0) {
			return;
		}
		this.show(timeline, target, state.status);
	}

	private show(timeline: PlaybackTimeline, index: number, status: "playing" | "paused"): void {
		const entry = timeline.entryAt(index);
		if (!entry) {
			this.stop();
			return;
		}
		this.clearTimer();
		this.store.set({ status, index, frameId: entry.frameId, frameCount: timeline.frameCount });
		if (status === "playing") {
			this.startTimer(entry.durationMs);
		} else {
			this.remainingMs = entry.durationMs;
		}
	}

	/** The shown frame's time is up: the next frame, or the end. */
	private advance(): void {
		this.cancelTimer = null;
		const state = this.current();
		if (state.status !== "playing") {
			return;
		}
		const timeline = this.source.timeline();
		const next = state.index + 1;
		if (next < timeline.frameCount) {
			this.show(timeline, next, "playing");
		} else if (this.source.loop() && timeline.frameCount >= 2) {
			this.show(timeline, 0, "playing");
		} else {
			this.stop();
		}
	}

	private startTimer(delayMs: number): void {
		this.clearTimer();
		this.deadline = this.scheduler.now() + delayMs;
		this.cancelTimer = this.scheduler.schedule(() => this.advance(), delayMs);
	}

	private clearTimer(): void {
		this.cancelTimer?.();
		this.cancelTimer = null;
	}
}
