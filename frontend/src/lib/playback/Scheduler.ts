/** Cancels a scheduled callback; calling it after the callback ran does nothing. */
export type Cancel = () => void;

/** Time source and one-shot timers, injectable so playback is testable without real time. */
export interface Scheduler {
	/** A monotonic time in milliseconds (only differences matter). */
	now(): number;
	/** Runs `callback` once after `delayMs`. */
	schedule(callback: () => void, delayMs: number): Cancel;
}

/** The browser's timers: `setTimeout`/`clearTimeout` and `performance.now()`. */
export class TimeoutScheduler implements Scheduler {
	now(): number {
		return typeof performance !== "undefined" ? performance.now() : Date.now();
	}

	schedule(callback: () => void, delayMs: number): Cancel {
		const handle = setTimeout(callback, Math.max(0, delayMs));
		return () => clearTimeout(handle);
	}
}
