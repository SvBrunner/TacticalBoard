/** What the timeline needs to know about a frame. */
export interface TimelineFrame {
	readonly id: string;
}

/** What the timeline needs to know about the playback settings. */
export interface TimelineSettings {
	/** How long every frame is shown, in milliseconds (one global duration, not per frame). */
	readonly frameDurationMs: number;
}

/** One frame's slot on the timeline. */
export interface TimelineEntry {
	readonly frameId: string;
	/** 0-based position of the frame in the situation. */
	readonly index: number;
	readonly startMs: number;
	readonly durationMs: number;
}

/**
 * When each frame of a situation is shown in a slideshow: the frames in
 * order, back to back, each for the same duration, with hard cuts between
 * them. Pure and immutable; shared by the in-editor playback and the
 * GIF export.
 */
export class PlaybackTimeline {
	readonly entries: readonly TimelineEntry[];
	/** Duration of one pass through all frames, in milliseconds. */
	readonly totalMs: number;

	private constructor(entries: readonly TimelineEntry[]) {
		this.entries = entries;
		const last = entries.at(-1);
		this.totalMs = last ? last.startMs + last.durationMs : 0;
	}

	static of(frames: readonly TimelineFrame[], settings: TimelineSettings): PlaybackTimeline {
		const duration = settings.frameDurationMs;
		if (!Number.isFinite(duration) || duration <= 0) {
			throw new Error(`Frame duration must be a positive number of milliseconds, got ${duration}`);
		}
		return new PlaybackTimeline(
			frames.map((frame, index) => ({ frameId: frame.id, index, startMs: index * duration, durationMs: duration })),
		);
	}

	get frameCount(): number {
		return this.entries.length;
	}

	/** The entry at a 0-based frame position, `undefined` outside the timeline. */
	entryAt(index: number): TimelineEntry | undefined {
		return Number.isInteger(index) ? this.entries[index] : undefined;
	}

	/**
	 * The frame shown at `ms` after the start: a frame covers
	 * `[startMs, startMs + durationMs)`, so at an exact boundary the next
	 * frame is shown. Times before the start give the first frame, times at
	 * or after the end the last one. `undefined` only without frames.
	 */
	frameAt(ms: number): TimelineEntry | undefined {
		if (this.entries.length === 0) {
			return undefined;
		}
		const found = this.entries.find((entry) => ms < entry.startMs + entry.durationMs);
		return found ?? this.entries[this.entries.length - 1];
	}
}
