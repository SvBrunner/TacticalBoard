import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { observeSize } from "./observeSize";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";

describe("observeSize", () => {
	let node: HTMLElement;

	beforeEach(() => {
		FakeResizeObserver.reset();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
		node = document.createElement("div");
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("observes the element", () => {
		observeSize(node, vi.fn());

		expect(FakeResizeObserver.instances).toHaveLength(1);
		expect(FakeResizeObserver.instances[0].observed.has(node)).toBe(true);
	});

	it("reports the content-box size on every resize", () => {
		const listener = vi.fn();
		observeSize(node, listener);

		FakeResizeObserver.resize(node, 300, 150);
		FakeResizeObserver.resize(node, 200, 100);

		expect(listener).toHaveBeenNthCalledWith(1, { width: 300, height: 150 });
		expect(listener).toHaveBeenNthCalledWith(2, { width: 200, height: 100 });
	});

	it("reports to the updated listener after update", () => {
		const first = vi.fn();
		const second = vi.fn();
		const action = observeSize(node, first);

		action?.update?.(second);
		FakeResizeObserver.resize(node, 10, 20);

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledWith({ width: 10, height: 20 });
	});

	it("disconnects the observer on destroy", () => {
		const listener = vi.fn();
		const action = observeSize(node, listener);

		action?.destroy?.();
		FakeResizeObserver.resize(node, 10, 20);

		expect(FakeResizeObserver.instances[0].disconnected).toBe(true);
		expect(listener).not.toHaveBeenCalled();
	});
});
