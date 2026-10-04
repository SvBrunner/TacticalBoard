import { describe, it, expect, beforeEach, vi } from "vitest";
import { SaveShortcut } from "./SaveShortcut";

function keydown(init: KeyboardEventInit, target?: Element): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { cancelable: true, bubbles: true, ...init });
	if (target) {
		Object.defineProperty(event, "target", { value: target });
	}
	return event;
}

describe("SaveShortcut", () => {
	let save: ReturnType<typeof vi.fn<() => void>>;
	let canSave: boolean;
	let shortcut: SaveShortcut;

	beforeEach(() => {
		save = vi.fn();
		canSave = true;
		shortcut = new SaveShortcut({ save, canSave: () => canSave });
	});

	it.each([
		["Ctrl+S", { key: "s", ctrlKey: true }],
		["Cmd+S", { key: "s", metaKey: true }],
		["Ctrl+S with caps lock", { key: "S", ctrlKey: true }],
	])("%s saves and prevents the browser's Save page", (_name, init) => {
		const event = keydown(init);

		expect(shortcut.handle(event)).toBe(true);

		expect(save).toHaveBeenCalledOnce();
		expect(event.defaultPrevented).toBe(true);
	});

	it("saves from a text field too", () => {
		const input = document.createElement("input");

		expect(shortcut.handle(keydown({ key: "s", ctrlKey: true }, input))).toBe(true);
		expect(save).toHaveBeenCalledOnce();
	});

	it.each([
		["plain S", { key: "s" }],
		["Ctrl+Shift+S", { key: "s", ctrlKey: true, shiftKey: true }],
		["Ctrl+Alt+S", { key: "s", ctrlKey: true, altKey: true }],
		["Ctrl+D", { key: "d", ctrlKey: true }],
		["IME composition", { key: "s", ctrlKey: true, isComposing: true }],
	])("ignores %s", (_name, init) => {
		const event = keydown(init);

		expect(shortcut.handle(event)).toBe(false);

		expect(save).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("leaves Ctrl+S to the browser when saving isn't possible (not logged in)", () => {
		canSave = false;
		const event = keydown({ key: "s", ctrlKey: true });

		expect(shortcut.handle(event)).toBe(false);
		expect(event.defaultPrevented).toBe(false);
	});

	it("inside a modal dialog prevents the browser's Save page but doesn't save", () => {
		const dialog = document.createElement("dialog");
		dialog.setAttribute("data-modal-dialog", "");
		const button = document.createElement("button");
		dialog.append(button);
		const event = keydown({ key: "s", ctrlKey: true }, button);

		expect(shortcut.handle(event)).toBe(true);

		expect(event.defaultPrevented).toBe(true);
		expect(save).not.toHaveBeenCalled();
	});
});
