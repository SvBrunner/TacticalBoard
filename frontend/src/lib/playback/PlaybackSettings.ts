import { get, writable, type Readable, type Writable } from "svelte/store";
import type { KeyValueStorage } from "./KeyValueStorage";

/** The frame durations the user can choose from, in milliseconds. */
export const FRAME_DURATION_CHOICES_MS: readonly number[] = [1000, 2000, 3000, 5000];

/**
 * App-level playback settings (not part of a situation file): one global
 * frame duration for all frames, and whether playback loops. Immutable.
 */
export class PlaybackSettings {
	static readonly DEFAULT = new PlaybackSettings(2000, false);

	private constructor(
		/** How long every frame is shown, one of `FRAME_DURATION_CHOICES_MS`. */
		readonly frameDurationMs: number,
		/** Whether playback starts over at frame 1 after the last frame instead of stopping. */
		readonly loop: boolean,
	) {}

	static isFrameDuration(value: unknown): value is number {
		return typeof value === "number" && FRAME_DURATION_CHOICES_MS.includes(value);
	}

	/**
	 * Reads settings from untrusted data (e.g. browser storage); every
	 * missing or invalid value falls back to its default.
	 */
	static from(data: unknown): PlaybackSettings {
		const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
		const duration = PlaybackSettings.isFrameDuration(record.frameDurationMs)
			? record.frameDurationMs
			: PlaybackSettings.DEFAULT.frameDurationMs;
		const loop = typeof record.loop === "boolean" ? record.loop : PlaybackSettings.DEFAULT.loop;
		return new PlaybackSettings(duration, loop);
	}

	/** Throws for a duration that isn't one of the choices. */
	withFrameDuration(frameDurationMs: number): PlaybackSettings {
		if (!PlaybackSettings.isFrameDuration(frameDurationMs)) {
			throw new Error(`Unsupported frame duration: ${frameDurationMs} ms`);
		}
		return frameDurationMs === this.frameDurationMs ? this : new PlaybackSettings(frameDurationMs, this.loop);
	}

	withLoop(loop: boolean): PlaybackSettings {
		return loop === this.loop ? this : new PlaybackSettings(this.frameDurationMs, loop);
	}

	toJSON(): { frameDurationMs: number; loop: boolean } {
		return { frameDurationMs: this.frameDurationMs, loop: this.loop };
	}
}

/**
 * The current playback settings, remembered in the browser (through a
 * `KeyValueStorage`) so they survive a reload. Storage problems (blocked,
 * full, corrupt data) never break playback: the defaults, or the last
 * value set in this session, are used instead.
 */
export class PlaybackSettingsStore {
	static readonly STORAGE_KEY = "tacticalboard.playbackSettings";

	private readonly store: Writable<PlaybackSettings>;

	readonly settings: Readable<PlaybackSettings>;

	constructor(private readonly storage: KeyValueStorage) {
		this.store = writable(this.load());
		this.settings = { subscribe: this.store.subscribe };
	}

	current(): PlaybackSettings {
		return get(this.store);
	}

	/** Changes the frame duration (one of `FRAME_DURATION_CHOICES_MS`; throws otherwise). */
	setFrameDuration(frameDurationMs: number): void {
		this.update(this.current().withFrameDuration(frameDurationMs));
	}

	setLoop(loop: boolean): void {
		this.update(this.current().withLoop(loop));
	}

	private update(next: PlaybackSettings): void {
		if (next === this.current()) {
			return;
		}
		this.store.set(next);
		this.storage.write(PlaybackSettingsStore.STORAGE_KEY, JSON.stringify(next));
	}

	private load(): PlaybackSettings {
		const raw = this.storage.read(PlaybackSettingsStore.STORAGE_KEY);
		if (raw === null) {
			return PlaybackSettings.DEFAULT;
		}
		try {
			return PlaybackSettings.from(JSON.parse(raw));
		} catch {
			return PlaybackSettings.DEFAULT;
		}
	}
}
