import { describe, it, expect, vi } from "vitest";
import { get } from "svelte/store";
import { MemoryKeyValueStorage, type KeyValueStorage } from "./KeyValueStorage";
import { FRAME_DURATION_CHOICES_MS, PlaybackSettings, PlaybackSettingsStore } from "./PlaybackSettings";

const KEY = PlaybackSettingsStore.STORAGE_KEY;

describe("PlaybackSettings", () => {
	it("offers 1, 2, 3 and 5 seconds", () => {
		expect(FRAME_DURATION_CHOICES_MS).toEqual([1000, 2000, 3000, 5000]);
	});

	it("defaults to 2 seconds per frame, no loop", () => {
		expect(PlaybackSettings.DEFAULT.toJSON()).toEqual({ frameDurationMs: 2000, loop: false });
	});

	it("changes the duration to another choice and keeps the loop", () => {
		const changed = PlaybackSettings.DEFAULT.withLoop(true).withFrameDuration(5000);

		expect(changed.toJSON()).toEqual({ frameDurationMs: 5000, loop: true });
		expect(PlaybackSettings.DEFAULT.toJSON()).toEqual({ frameDurationMs: 2000, loop: false });
	});

	it("returns the same instance when nothing changes", () => {
		expect(PlaybackSettings.DEFAULT.withFrameDuration(2000)).toBe(PlaybackSettings.DEFAULT);
		expect(PlaybackSettings.DEFAULT.withLoop(false)).toBe(PlaybackSettings.DEFAULT);
	});

	it.each([[1500], [0], [-1000], [Number.NaN]])("rejects the duration %s", (ms) => {
		expect(() => PlaybackSettings.DEFAULT.withFrameDuration(ms)).toThrow(/Unsupported/);
	});

	describe("from (untrusted data)", () => {
		it("reads valid values", () => {
			expect(PlaybackSettings.from({ frameDurationMs: 3000, loop: true }).toJSON()).toEqual({ frameDurationMs: 3000, loop: true });
		});

		it.each([
			["null", null],
			["a string", "2000"],
			["an empty object", {}],
			["invalid values", { frameDurationMs: 2500, loop: "yes" }],
			["wrong types", { frameDurationMs: "1000", loop: 1 }],
		])("falls back to the defaults for %s", (_label, data) => {
			expect(PlaybackSettings.from(data).toJSON()).toEqual({ frameDurationMs: 2000, loop: false });
		});

		it("keeps each valid value on its own", () => {
			expect(PlaybackSettings.from({ frameDurationMs: 1000, loop: "x" }).toJSON()).toEqual({ frameDurationMs: 1000, loop: false });
			expect(PlaybackSettings.from({ frameDurationMs: 7, loop: true }).toJSON()).toEqual({ frameDurationMs: 2000, loop: true });
		});
	});
});

describe("PlaybackSettingsStore", () => {
	it("starts with the defaults when nothing is stored", () => {
		const store = new PlaybackSettingsStore(new MemoryKeyValueStorage());

		expect(store.current()).toBe(PlaybackSettings.DEFAULT);
		expect(get(store.settings)).toBe(PlaybackSettings.DEFAULT);
	});

	it("remembers changes in the storage, so a new store starts with them", () => {
		const storage = new MemoryKeyValueStorage();
		const store = new PlaybackSettingsStore(storage);

		store.setFrameDuration(5000);
		store.setLoop(true);

		expect(JSON.parse(storage.read(KEY)!)).toEqual({ frameDurationMs: 5000, loop: true });
		expect(new PlaybackSettingsStore(storage).current().toJSON()).toEqual({ frameDurationMs: 5000, loop: true });
	});

	it("notifies subscribers of changes", () => {
		const store = new PlaybackSettingsStore(new MemoryKeyValueStorage());
		const seen: number[] = [];
		const unsubscribe = store.settings.subscribe((settings) => seen.push(settings.frameDurationMs));

		store.setFrameDuration(1000);
		store.setFrameDuration(1000);
		unsubscribe();

		expect(seen).toEqual([2000, 1000]);
	});

	it("doesn't write when nothing changes", () => {
		const storage = { read: vi.fn(() => null), write: vi.fn(() => true) };
		const store = new PlaybackSettingsStore(storage);

		store.setLoop(false);
		store.setFrameDuration(2000);

		expect(storage.write).not.toHaveBeenCalled();
	});

	it("rejects a duration that isn't a choice and keeps the current one", () => {
		const store = new PlaybackSettingsStore(new MemoryKeyValueStorage());

		expect(() => store.setFrameDuration(4000)).toThrow();
		expect(store.current().frameDurationMs).toBe(2000);
	});

	it.each([
		["corrupt JSON", "{not json"],
		["invalid values", JSON.stringify({ frameDurationMs: 42, loop: "no" })],
		["JSON null", "null"],
	])("falls back to the defaults for %s in the storage", (_label, raw) => {
		const storage = new MemoryKeyValueStorage();
		storage.write(KEY, raw);

		expect(new PlaybackSettingsStore(storage).current().toJSON()).toEqual({ frameDurationMs: 2000, loop: false });
	});

	it("keeps working in memory when the storage can't be written", () => {
		const failing: KeyValueStorage = { read: () => null, write: () => false };
		const store = new PlaybackSettingsStore(failing);

		store.setLoop(true);

		expect(store.current().loop).toBe(true);
	});
});
