import { describe, it, expect, vi, afterEach } from "vitest";
import { FixedClock, SystemClock } from "./Clock";

describe("SystemClock", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the current system time", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-05-05T05:05:05.000Z"));

		expect(new SystemClock().now().toISOString()).toBe("2026-05-05T05:05:05.000Z");
	});
});

describe("FixedClock", () => {
	it("returns the start time", () => {
		expect(new FixedClock("2026-02-03T04:05:06.000Z").now().toISOString()).toBe("2026-02-03T04:05:06.000Z");
	});

	it("can be set and advanced", () => {
		const clock = new FixedClock();
		clock.set("2026-01-01T10:00:00.000Z");
		clock.advance(1500);

		expect(clock.now().toISOString()).toBe("2026-01-01T10:00:01.500Z");
	});

	it("returns a defensive copy", () => {
		const clock = new FixedClock("2026-01-01T00:00:00.000Z");
		clock.now().setFullYear(2000);

		expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
	});
});
