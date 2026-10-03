import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { get, writable, type Writable } from "svelte/store";
import { Selection } from "./Selection";
import { PointElement } from "$lib/model/elements/PointElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";

const a = new PointElement("a", 1, 2, "red", "Player");
const b = new PointElement("b", 3, 4, "blue", "Ball");

describe("Selection", () => {
	let elements: Writable<readonly BoardElement[]>;
	let selection: Selection;

	beforeEach(() => {
		elements = writable<readonly BoardElement[]>([a, b]);
		selection = new Selection(elements);
	});

	afterEach(() => {
		selection.destroy();
	});

	it("starts with nothing selected", () => {
		expect(selection.current()).toBeNull();
		expect(get(selection.selectedId)).toBeNull();
		expect(get(selection.selected)).toBeNull();
	});

	it("select makes an element the selected one", () => {
		selection.select("b");

		expect(selection.current()).toBe("b");
		expect(get(selection.selectedId)).toBe("b");
		expect(get(selection.selected)).toBe(b);
	});

	it("selecting another element replaces the selection", () => {
		selection.select("a");
		selection.select("b");

		expect(selection.current()).toBe("b");
	});

	it("ignores unknown ids", () => {
		selection.select("a");
		selection.select("missing");

		expect(selection.current()).toBe("a");
	});

	it("clear removes the selection", () => {
		selection.select("a");
		selection.clear();

		expect(selection.current()).toBeNull();
		expect(get(selection.selected)).toBeNull();
	});

	it("selected follows changes to the selected element", () => {
		selection.select("a");
		const recolored = a.withColor("green");

		elements.set([recolored, b]);

		expect(get(selection.selected)).toBe(recolored);
	});

	it("clears itself when the selected element disappears", () => {
		selection.select("a");

		elements.set([b]);

		expect(selection.current()).toBeNull();
	});

	it("stays cleared when the element comes back (e.g. undo of a delete)", () => {
		selection.select("a");
		elements.set([b]);

		elements.set([a, b]);

		expect(selection.current()).toBeNull();
	});

	it("keeps the selection when other elements change", () => {
		selection.select("a");

		elements.set([a]);

		expect(selection.current()).toBe("a");
	});

	it("stops following the elements after destroy", () => {
		selection.select("a");
		selection.destroy();

		elements.set([b]);

		expect(selection.current()).toBe("a");
	});
});
