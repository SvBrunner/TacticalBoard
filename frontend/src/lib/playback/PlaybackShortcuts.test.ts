import { describe, it, expect, beforeEach, vi } from "vitest";
import { PlaybackShortcuts, type PlaybackActions, type PlaybackKeyInput } from "./PlaybackShortcuts";

function actions(overrides: Partial<PlaybackActions> = {}) {
	return {
		isActive: vi.fn(() => false),
		canPlay: vi.fn(() => true),
		toggle: vi.fn(),
		next: vi.fn(),
		previous: vi.fn(),
		stop: vi.fn(),
		...overrides,
	};
}

function key(name: string, overrides: Partial<PlaybackKeyInput> = {}) {
	return { key: name, target: document.body, preventDefault: vi.fn(), ...overrides };
}

describe("PlaybackShortcuts", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	describe("Space", () => {
		it("starts playback when stopped and there is something to play", () => {
			const playback = actions();
			const event = key(" ");

			expect(new PlaybackShortcuts(playback).handle(event)).toBe(true);
			expect(playback.toggle).toHaveBeenCalledOnce();
			expect(event.preventDefault).toHaveBeenCalled();
		});

		it("toggles pause during playback", () => {
			const playback = actions({ isActive: () => true, canPlay: () => false });

			expect(new PlaybackShortcuts(playback).handle(key(" "))).toBe(true);
			expect(playback.toggle).toHaveBeenCalledOnce();
		});

		it("does nothing (and keeps the default) with a single frame", () => {
			const playback = actions({ canPlay: () => false });
			const event = key(" ");

			expect(new PlaybackShortcuts(playback).handle(event)).toBe(false);
			expect(playback.toggle).not.toHaveBeenCalled();
			expect(event.preventDefault).not.toHaveBeenCalled();
		});

		it("accepts the legacy 'Spacebar' key name", () => {
			const playback = actions();

			expect(new PlaybackShortcuts(playback).handle(key("Spacebar"))).toBe(true);
		});

		it.each([
			["a button", "<button>b</button>", "button"],
			["a link", '<a href="/">l</a>', "a"],
			["a role=button element", '<div role="button" tabindex="0">x</div>', "div"],
		])("is left to %s, which Space activates itself", (_label, html, selector) => {
			document.body.innerHTML = html;
			const playback = actions({ isActive: () => true });

			expect(new PlaybackShortcuts(playback).handle(key(" ", { target: document.querySelector(selector) }))).toBe(false);
			expect(playback.toggle).not.toHaveBeenCalled();
		});
	});

	describe("arrow keys", () => {
		it("show the previous / next frame during playback", () => {
			const playback = actions({ isActive: () => true });
			const shortcuts = new PlaybackShortcuts(playback);
			const left = key("ArrowLeft");

			expect(shortcuts.handle(left)).toBe(true);
			expect(shortcuts.handle(key("ArrowRight"))).toBe(true);

			expect(playback.previous).toHaveBeenCalledOnce();
			expect(playback.next).toHaveBeenCalledOnce();
			expect(left.preventDefault).toHaveBeenCalled();
		});

		it("work on a focused button too", () => {
			document.body.innerHTML = "<button>b</button>";
			const playback = actions({ isActive: () => true });

			expect(new PlaybackShortcuts(playback).handle(key("ArrowRight", { target: document.querySelector("button") }))).toBe(true);
		});

		it("do nothing outside playback (frame switching by keyboard isn't a feature)", () => {
			const playback = actions();
			const event = key("ArrowRight");

			expect(new PlaybackShortcuts(playback).handle(event)).toBe(false);
			expect(new PlaybackShortcuts(playback).handle(key("ArrowLeft"))).toBe(false);
			expect(playback.next).not.toHaveBeenCalled();
			expect(event.preventDefault).not.toHaveBeenCalled();
		});
	});

	describe("Escape", () => {
		it("stops playback", () => {
			const playback = actions({ isActive: () => true });

			expect(new PlaybackShortcuts(playback).handle(key("Escape"))).toBe(true);
			expect(playback.stop).toHaveBeenCalledOnce();
		});

		it("is left to others outside playback", () => {
			const playback = actions();

			expect(new PlaybackShortcuts(playback).handle(key("Escape"))).toBe(false);
			expect(playback.stop).not.toHaveBeenCalled();
		});
	});

	describe("ignored", () => {
		it.each([
			["a text input", '<input type="text" />', "input"],
			["a textarea", "<textarea></textarea>", "textarea"],
			["a select", "<select><option>1</option></select>", "select"],
			["a contenteditable element", '<div contenteditable="true"></div>', "div"],
		])("while focus is in %s", (_label, html, selector) => {
			document.body.innerHTML = html;
			const playback = actions({ isActive: () => true });
			const shortcuts = new PlaybackShortcuts(playback);
			const target = document.querySelector(selector);

			for (const name of [" ", "ArrowLeft", "ArrowRight", "Escape"]) {
				expect(shortcuts.handle(key(name, { target }))).toBe(false);
			}
			expect(playback.toggle).not.toHaveBeenCalled();
			expect(playback.stop).not.toHaveBeenCalled();
		});

		it.each([["ctrlKey"], ["metaKey"], ["altKey"], ["isComposing"]])("with %s", (flag) => {
			const playback = actions({ isActive: () => true });

			expect(new PlaybackShortcuts(playback).handle(key(" ", { [flag]: true }))).toBe(false);
			expect(new PlaybackShortcuts(playback).handle(key("ArrowRight", { [flag]: true }))).toBe(false);
			expect(playback.toggle).not.toHaveBeenCalled();
		});

		it("for other keys", () => {
			const playback = actions({ isActive: () => true });

			expect(new PlaybackShortcuts(playback).handle(key("Enter"))).toBe(false);
			expect(new PlaybackShortcuts(playback).handle(key("Delete"))).toBe(false);
		});

		it("without a target element", () => {
			const playback = actions({ isActive: () => true });

			expect(new PlaybackShortcuts(playback).handle(key("Escape", { target: null }))).toBe(true);
		});
	});
});
