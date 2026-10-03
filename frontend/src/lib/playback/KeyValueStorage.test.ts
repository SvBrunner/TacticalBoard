import { describe, it, expect, afterEach, vi } from "vitest";
import { MemoryKeyValueStorage, WebKeyValueStorage, type WebStorage } from "./KeyValueStorage";

function fakeWebStorage(): WebStorage & { values: Map<string, string> } {
	const values = new Map<string, string>();
	return {
		values,
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => void values.set(key, value),
	};
}

describe("WebKeyValueStorage", () => {
	afterEach(() => {
		localStorage.clear();
		vi.unstubAllGlobals();
	});

	it("reads and writes through the given web storage", () => {
		const web = fakeWebStorage();
		const storage = new WebKeyValueStorage(() => web);

		expect(storage.read("k")).toBeNull();
		expect(storage.write("k", "v")).toBe(true);
		expect(web.values.get("k")).toBe("v");
		expect(storage.read("k")).toBe("v");
	});

	it("uses localStorage by default", () => {
		const storage = new WebKeyValueStorage();

		storage.write("tb-test", "1");

		expect(localStorage.getItem("tb-test")).toBe("1");
		expect(storage.read("tb-test")).toBe("1");
	});

	it("reports nothing stored and refuses writes without a storage", () => {
		const storage = new WebKeyValueStorage(() => null);

		expect(storage.read("k")).toBeNull();
		expect(storage.write("k", "v")).toBe(false);
	});

	it("swallows errors of the storage itself (blocked, full)", () => {
		const throwing: WebStorage = {
			getItem: () => {
				throw new Error("SecurityError");
			},
			setItem: () => {
				throw new Error("QuotaExceededError");
			},
		};
		const storage = new WebKeyValueStorage(() => throwing);

		expect(storage.read("k")).toBeNull();
		expect(storage.write("k", "v")).toBe(false);
	});

	it("swallows errors when accessing the storage throws", () => {
		const storage = new WebKeyValueStorage(() => {
			throw new Error("SecurityError: access denied");
		});

		expect(storage.read("k")).toBeNull();
		expect(storage.write("k", "v")).toBe(false);
	});
});

describe("MemoryKeyValueStorage", () => {
	it("keeps values in memory", () => {
		const storage = new MemoryKeyValueStorage();

		expect(storage.read("k")).toBeNull();
		expect(storage.write("k", "v")).toBe(true);
		expect(storage.read("k")).toBe("v");
	});
});
