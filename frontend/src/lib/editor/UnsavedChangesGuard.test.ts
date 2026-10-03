import { describe, it, expect } from "vitest";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";

function beforeUnload(): BeforeUnloadEvent {
	return new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
}

describe("UnsavedChangesGuard", () => {
	it("cancels the unload (browser warning) while there are unsaved changes", () => {
		const event = beforeUnload();

		new UnsavedChangesGuard(() => true).handleBeforeUnload(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it("lets the page unload without warning when everything is saved", () => {
		const event = beforeUnload();

		new UnsavedChangesGuard(() => false).handleBeforeUnload(event);

		expect(event.defaultPrevented).toBe(false);
	});

	it("checks the state at unload time, not at construction", () => {
		let dirty = false;
		const guard = new UnsavedChangesGuard(() => dirty);
		dirty = true;
		const event = beforeUnload();

		guard.handleBeforeUnload(event);

		expect(event.defaultPrevented).toBe(true);
	});

	it("attach listens for beforeunload on the target until detached", () => {
		const target = new EventTarget();
		const detach = new UnsavedChangesGuard(() => true).attach(target as never);

		const first = beforeUnload();
		target.dispatchEvent(first);
		expect(first.defaultPrevented).toBe(true);

		detach();
		const second = beforeUnload();
		target.dispatchEvent(second);
		expect(second.defaultPrevented).toBe(false);
	});

	it("works on window", () => {
		const detach = new UnsavedChangesGuard(() => true).attach(window);
		const event = beforeUnload();

		window.dispatchEvent(event);
		detach();

		expect(event.defaultPrevented).toBe(true);
	});
});
