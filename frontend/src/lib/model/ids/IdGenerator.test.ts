import { describe, it, expect } from "vitest";
import { SequentialIdGenerator, UuidIdGenerator } from "./IdGenerator";

describe("UuidIdGenerator", () => {
	it("generates UUID v4 values", () => {
		const id = new UuidIdGenerator().next();

		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it("generates a different id on each call", () => {
		const ids = new UuidIdGenerator();

		expect(ids.next()).not.toBe(ids.next());
	});
});

describe("SequentialIdGenerator", () => {
	it("counts up from 1 with the default prefix", () => {
		const ids = new SequentialIdGenerator();

		expect([ids.next(), ids.next(), ids.next()]).toEqual(["id-1", "id-2", "id-3"]);
	});

	it("uses the given prefix", () => {
		expect(new SequentialIdGenerator("frame-").next()).toBe("frame-1");
	});

	it("keeps separate counters per instance", () => {
		const a = new SequentialIdGenerator("a");
		const b = new SequentialIdGenerator("b");
		a.next();

		expect(b.next()).toBe("b1");
		expect(a.next()).toBe("a2");
	});
});
