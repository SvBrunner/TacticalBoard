/** Source of the current time, injectable so timestamps are testable. */
export interface Clock {
	now(): Date;
}

/** Production clock: the system time. */
export class SystemClock implements Clock {
	now(): Date {
		return new Date();
	}
}

/** Manually controlled clock, intended for tests. */
export class FixedClock implements Clock {
	private current: Date;

	constructor(start: Date | string = "2026-01-01T00:00:00.000Z") {
		this.current = new Date(start);
	}

	now(): Date {
		return new Date(this.current.getTime());
	}

	set(time: Date | string): void {
		this.current = new Date(time);
	}

	advance(milliseconds: number): void {
		this.current = new Date(this.current.getTime() + milliseconds);
	}
}
