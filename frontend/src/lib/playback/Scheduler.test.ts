import { describe, it, expect, afterEach, vi } from "vitest";
import { FakeScheduler } from "$lib/testing/FakeScheduler";
import { TimeoutScheduler } from "./Scheduler";

describe("TimeoutScheduler", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("runs the callback once after the delay", () => {
		vi.useFakeTimers();
		const callback = vi.fn();

		new TimeoutScheduler().schedule(callback, 1000);
		vi.advanceTimersByTime(999);
		expect(callback).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(callback).toHaveBeenCalledOnce();
		vi.advanceTimersByTime(5000);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("cancels the callback", () => {
		vi.useFakeTimers();
		const callback = vi.fn();

		const cancel = new TimeoutScheduler().schedule(callback, 1000);
		cancel();
		vi.advanceTimersByTime(2000);

		expect(callback).not.toHaveBeenCalled();
	});

	it("has a clock that moves forward", () => {
		vi.useFakeTimers();
		const scheduler = new TimeoutScheduler();
		const before = scheduler.now();

		vi.advanceTimersByTime(250);

		expect(scheduler.now() - before).toBeGreaterThanOrEqual(250);
	});
});

describe("FakeScheduler", () => {
	it("runs due timers in order, also ones scheduled by a callback", () => {
		const scheduler = new FakeScheduler();
		const calls: string[] = [];
		scheduler.schedule(() => calls.push("b"), 200);
		scheduler.schedule(() => {
			calls.push("a");
			scheduler.schedule(() => calls.push("a2"), 50);
		}, 100);

		scheduler.advance(160);
		expect(calls).toEqual(["a", "a2"]);
		expect(scheduler.now()).toBe(160);

		scheduler.advance(40);
		expect(calls).toEqual(["a", "a2", "b"]);
		expect(scheduler.pending).toBe(0);
	});

	it("cancels timers", () => {
		const scheduler = new FakeScheduler();
		const callback = vi.fn();

		scheduler.schedule(callback, 10)();
		scheduler.advance(100);

		expect(callback).not.toHaveBeenCalled();
	});
});
