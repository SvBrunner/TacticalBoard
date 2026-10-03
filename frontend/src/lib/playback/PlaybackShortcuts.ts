/** The playback operations the shortcuts trigger; implemented by `SlideshowPlayer`. */
export interface PlaybackActions {
	isActive(): boolean;
	canPlay(): boolean;
	toggle(): void;
	next(): void;
	previous(): void;
	stop(): void;
}

/** The parts of a keyboard event the shortcuts look at. */
export interface PlaybackKeyInput {
	readonly key: string;
	readonly target: EventTarget | null;
	readonly isComposing?: boolean;
	readonly ctrlKey?: boolean;
	readonly metaKey?: boolean;
	readonly altKey?: boolean;
	preventDefault(): void;
}

const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
/** Controls that Space activates by itself; Space stays theirs. */
const SPACE_CONTROL_SELECTOR = 'button, a[href], summary, [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="link"]';

/**
 * Playback keyboard shortcuts:
 * - Space: Play/Pause (starts playback when stopped, if there is anything to play).
 * - ← / →: previous / next frame — only during playback (playing or
 *   paused); switching frames by keyboard outside playback isn't a feature.
 * - Escape: stops playback — only during playback.
 *
 * Ignored while typing in a text field or select, during IME composition,
 * and with Ctrl, Cmd or Alt held. Space is also left to a focused button
 * or link, which it activates itself (so it never triggers twice).
 */
export class PlaybackShortcuts {
	constructor(private readonly actions: PlaybackActions) {}

	/** Handles a keydown event; returns true (and prevents the default) when it triggered a playback action. */
	handle(event: PlaybackKeyInput): boolean {
		if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || PlaybackShortcuts.matches(event.target, TEXT_ENTRY_SELECTOR)) {
			return false;
		}
		switch (event.key) {
			case " ":
			case "Spacebar":
				if (PlaybackShortcuts.matches(event.target, SPACE_CONTROL_SELECTOR)) {
					return false;
				}
				if (!this.actions.isActive() && !this.actions.canPlay()) {
					return false;
				}
				return this.run(event, () => this.actions.toggle());
			case "ArrowLeft":
				return this.actions.isActive() && this.run(event, () => this.actions.previous());
			case "ArrowRight":
				return this.actions.isActive() && this.run(event, () => this.actions.next());
			case "Escape":
				return this.actions.isActive() && this.run(event, () => this.actions.stop());
			default:
				return false;
		}
	}

	private run(event: PlaybackKeyInput, action: () => void): true {
		event.preventDefault();
		action();
		return true;
	}

	private static matches(target: EventTarget | null, selector: string): boolean {
		return typeof Element !== "undefined" && target instanceof Element && target.closest(selector) !== null;
	}
}
