import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { get } from "svelte/store";
import { NotificationCenter } from "./Notifications";

describe("NotificationCenter", () => {
	let center: NotificationCenter;

	beforeEach(() => {
		vi.useFakeTimers();
		center = new NotificationCenter();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("starts empty", () => {
		expect(get(center.notifications)).toEqual([]);
	});

	it("notify adds a notification with the given message and level", () => {
		center.notify("hello", "warn");

		const [n] = get(center.notifications);
		expect(n).toMatchObject({ message: "hello", level: "warn" });
		expect(n.id).toBeTruthy();
	});

	it("defaults to info level", () => {
		center.notify("hello");

		expect(get(center.notifications)[0].level).toBe("info");
	});

	it("auto-dismisses after the given duration", () => {
		center.notify("hello", "info", 1000);
		expect(get(center.notifications)).toHaveLength(1);

		vi.advanceTimersByTime(999);
		expect(get(center.notifications)).toHaveLength(1);

		vi.advanceTimersByTime(1);
		expect(get(center.notifications)).toHaveLength(0);
	});

	it("dismiss removes a specific notification early and cancels its timer", () => {
		const id = center.notify("hello", "info", 5000);
		center.notify("world", "info", 5000);

		center.dismiss(id);

		const remaining = get(center.notifications);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].message).toBe("world");
	});

	it("clear removes everything and cancels pending timers", () => {
		center.notify("a");
		center.notify("b");

		center.clear();

		expect(get(center.notifications)).toEqual([]);
		// advancing time must not throw or resurrect anything after clear()
		vi.advanceTimersByTime(10000);
		expect(get(center.notifications)).toEqual([]);
	});
});
