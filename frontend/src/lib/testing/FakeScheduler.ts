import type { Cancel, Scheduler } from "$lib/playback/Scheduler";

interface Timer {
	readonly id: number;
	readonly dueAt: number;
	readonly callback: () => void;
}

/** A `Scheduler` driven by the test: time only passes through `advance`. */
export class FakeScheduler implements Scheduler {
	private time = 0;
	private nextId = 0;
	private timers: Timer[] = [];

	now(): number {
		return this.time;
	}

	schedule(callback: () => void, delayMs: number): Cancel {
		const timer = { id: this.nextId++, dueAt: this.time + Math.max(0, delayMs), callback };
		this.timers.push(timer);
		return () => {
			this.timers = this.timers.filter((candidate) => candidate.id !== timer.id);
		};
	}

	/** Number of timers that haven't run or been cancelled yet. */
	get pending(): number {
		return this.timers.length;
	}

	/** Lets `ms` pass, running every timer that becomes due (in due order, also ones scheduled meanwhile). */
	advance(ms: number): void {
		const end = this.time + ms;
		for (;;) {
			const next = [...this.timers].sort((a, b) => a.dueAt - b.dueAt || a.id - b.id)[0];
			if (!next || next.dueAt > end) {
				break;
			}
			this.timers = this.timers.filter((candidate) => candidate.id !== next.id);
			this.time = next.dueAt;
			next.callback();
		}
		this.time = end;
	}
}
