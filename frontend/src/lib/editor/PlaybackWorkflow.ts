import type { Readable } from "svelte/store";
import type { PlaybackActions } from "$lib/playback/PlaybackShortcuts";
import type { PlaybackState } from "$lib/playback/SlideshowPlayer";

/** The player operations the workflow uses; implemented by `SlideshowPlayer`. */
export interface PlaybackPlayer {
	readonly state: Readable<PlaybackState>;
	isActive(): boolean;
	canPlay(): boolean;
	play(): void;
	pause(): void;
	toggle(): void;
	stop(): void;
	next(): void;
	previous(): void;
	seek(index: number): void;
}

export interface PlaybackWorkflowLog {
	notify(message: string): void;
}

export interface PlaybackWorkflowDependencies {
	readonly player: PlaybackPlayer;
	/**
	 * The edited situation. When it changes while the slideshow runs (a
	 * situation was imported, created or closed) playback stops.
	 */
	readonly situation: Readable<unknown>;
	/**
	 * Runs right before playback starts, to leave editing cleanly: end the
	 * edit session, clear the selection, close the popover, drop an arrow
	 * being drawn.
	 */
	readonly beforeStart: () => void;
	readonly log?: PlaybackWorkflowLog;
}

/**
 * The editor's playback use cases: Play/Pause, Previous, Next, Stop, and
 * jumping to a frame of the strip during playback. Starting playback first
 * leaves editing (see `beforeStart`); the model is never changed, the
 * board only shows the slideshow's frame while it runs.
 */
export class PlaybackWorkflow implements PlaybackActions {
	private readonly unsubscribe: () => void;

	constructor(private readonly deps: PlaybackWorkflowDependencies) {
		let previous: unknown;
		let first = true;
		this.unsubscribe = deps.situation.subscribe((situation) => {
			if (!first && situation !== previous && deps.player.isActive()) {
				deps.player.stop();
				this.log("Playback stopped: the situation changed");
			}
			first = false;
			previous = situation;
		});
	}

	isActive(): boolean {
		return this.deps.player.isActive();
	}

	canPlay(): boolean {
		return this.deps.player.canPlay();
	}

	/** Starts playback at frame 1 (needs at least two frames); resumes when paused. */
	play(): void {
		if (this.deps.player.isActive()) {
			this.deps.player.play();
			return;
		}
		if (!this.deps.player.canPlay()) {
			return;
		}
		this.deps.beforeStart();
		this.deps.player.play();
		this.log("Playback started");
	}

	pause(): void {
		this.deps.player.pause();
	}

	/** Play/Pause. */
	toggle(): void {
		if (this.deps.player.isActive()) {
			this.deps.player.toggle();
		} else {
			this.play();
		}
	}

	stop(): void {
		if (this.deps.player.isActive()) {
			this.deps.player.stop();
			this.log("Playback stopped");
		}
	}

	next(): void {
		this.deps.player.next();
	}

	previous(): void {
		this.deps.player.previous();
	}

	/** During playback: shows the frame at that 0-based position. */
	showFrame(index: number): void {
		this.deps.player.seek(index);
	}

	/** Stops playback and the situation subscription (when the editor goes away). */
	destroy(): void {
		this.unsubscribe();
		this.deps.player.stop();
	}

	private log(message: string): void {
		this.deps.log?.notify(message);
	}
}
