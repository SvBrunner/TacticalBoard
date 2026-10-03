/** A small string key/value store, e.g. the browser's `localStorage`. Never throws. */
export interface KeyValueStorage {
	/** The stored value, or `null` when there is none or it can't be read. */
	read(key: string): string | null;
	/** Stores the value; returns false when it couldn't be stored. */
	write(key: string, value: string): boolean;
}

/** The parts of the Web Storage API this adapter uses. */
export type WebStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * `KeyValueStorage` on top of Web Storage (by default `localStorage`).
 * Storage can be unavailable (no `window`, privacy settings, sandboxed
 * iframes) or full; every such failure is swallowed, so callers fall back
 * to their defaults instead of breaking.
 */
export class WebKeyValueStorage implements KeyValueStorage {
	constructor(private readonly resolveStorage: () => WebStorage | null | undefined = WebKeyValueStorage.localStorage) {}

	read(key: string): string | null {
		try {
			return this.resolveStorage()?.getItem(key) ?? null;
		} catch {
			return null;
		}
	}

	write(key: string, value: string): boolean {
		try {
			const storage = this.resolveStorage();
			if (!storage) {
				return false;
			}
			storage.setItem(key, value);
			return true;
		} catch {
			return false;
		}
	}

	/** Accessing `localStorage` itself can throw (e.g. when site data is blocked). */
	private static localStorage(): WebStorage | null {
		return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
	}
}

/** Keeps values in memory only; for tests and as a stand-in where nothing should be persisted. */
export class MemoryKeyValueStorage implements KeyValueStorage {
	private readonly values = new Map<string, string>();

	read(key: string): string | null {
		return this.values.get(key) ?? null;
	}

	write(key: string, value: string): boolean {
		this.values.set(key, value);
		return true;
	}
}
