import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UndoRedoShortcuts } from "./UndoRedoShortcuts";

function keydown(init: KeyboardEventInit, target: EventTarget = document.body): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { cancelable: true, bubbles: true, ...init });
	Object.defineProperty(event, "target", { value: target });
	return event;
}

describe("UndoRedoShortcuts", () => {
	let undo: ReturnType<typeof vi.fn<() => void>>;
	let redo: ReturnType<typeof vi.fn<() => void>>;
	let blocked: boolean;
	let shortcuts: UndoRedoShortcuts;

	beforeEach(() => {
		undo = vi.fn<() => void>();
		redo = vi.fn<() => void>();
		blocked = false;
		shortcuts = new UndoRedoShortcuts({ undo, redo, isBlocked: () => blocked });
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it.each([
		["Ctrl+Z", { key: "z", ctrlKey: true }],
		["Cmd+Z", { key: "z", metaKey: true }],
		["Ctrl+Z with caps lock", { key: "Z", ctrlKey: true }],
	])("%s undoes", (_name, init) => {
		const event = keydown(init);

		expect(shortcuts.handle(event)).toBe(true);

		expect(undo).toHaveBeenCalledOnce();
		expect(redo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it.each([
		["Ctrl+Shift+Z", { key: "Z", ctrlKey: true, shiftKey: true }],
		["Cmd+Shift+Z", { key: "Z", metaKey: true, shiftKey: true }],
		["Ctrl+Y", { key: "y", ctrlKey: true }],
	])("%s redoes", (_name, init) => {
		const event = keydown(init);

		expect(shortcuts.handle(event)).toBe(true);

		expect(redo).toHaveBeenCalledOnce();
		expect(undo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it.each([
		["Cmd+Y", { key: "y", metaKey: true }],
		["Ctrl+Shift+Y", { key: "Y", ctrlKey: true, shiftKey: true }],
		["plain Z", { key: "z" }],
		["Shift+Z", { key: "Z", shiftKey: true }],
		["plain Y", { key: "y" }],
		["Ctrl+Alt+Z", { key: "z", ctrlKey: true, altKey: true }],
		["Ctrl+Alt+Y", { key: "y", ctrlKey: true, altKey: true }],
		["Ctrl+X", { key: "x", ctrlKey: true }],
	])("%s is ignored", (_name, init) => {
		const event = keydown(init);

		expect(shortcuts.handle(event)).toBe(false);

		expect(undo).not.toHaveBeenCalled();
		expect(redo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it.each([
		["input", () => document.createElement("input")],
		["textarea", () => document.createElement("textarea")],
		["select", () => document.createElement("select")],
		[
			"contenteditable element",
			() => {
				const div = document.createElement("div");
				div.setAttribute("contenteditable", "true");
				return div;
			},
		],
		[
			"child of a contenteditable element",
			() => {
				const div = document.createElement("div");
				div.setAttribute("contenteditable", "");
				const span = document.createElement("span");
				div.appendChild(span);
				return span;
			},
		],
	])("is ignored when typing in a %s", (_name, create) => {
		const target = create();
		document.body.appendChild(target.closest("[contenteditable]") ?? target);
		const event = keydown({ key: "z", ctrlKey: true }, target);

		expect(shortcuts.handle(event)).toBe(false);
		expect(undo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("is not ignored on an element with contenteditable=false", () => {
		const div = document.createElement("div");
		div.setAttribute("contenteditable", "false");
		document.body.appendChild(div);

		expect(shortcuts.handle(keydown({ key: "z", ctrlKey: true }, div))).toBe(true);
	});

	it("handles events on buttons and other non-text elements", () => {
		const button = document.createElement("button");
		document.body.appendChild(button);

		expect(shortcuts.handle(keydown({ key: "z", ctrlKey: true }, button))).toBe(true);
	});

	it("handles events whose target is not an element (e.g. window)", () => {
		expect(shortcuts.handle(keydown({ key: "z", ctrlKey: true }, window))).toBe(true);
	});

	it("is ignored during IME composition", () => {
		const event = keydown({ key: "z", ctrlKey: true, isComposing: true });

		expect(shortcuts.handle(event)).toBe(false);
		expect(undo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);
	});

	it("is ignored while blocked and works again afterwards", () => {
		blocked = true;
		const event = keydown({ key: "z", ctrlKey: true });

		expect(shortcuts.handle(event)).toBe(false);
		expect(undo).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(false);

		blocked = false;
		expect(shortcuts.handle(keydown({ key: "z", ctrlKey: true }))).toBe(true);
		expect(undo).toHaveBeenCalledOnce();
	});

	it("works without an isBlocked callback", () => {
		const plain = new UndoRedoShortcuts({ undo, redo });

		expect(plain.handle(keydown({ key: "y", ctrlKey: true }))).toBe(true);
		expect(redo).toHaveBeenCalledOnce();
	});
});
