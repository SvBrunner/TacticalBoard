import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { get, writable, type Writable } from "svelte/store";
import { Selection } from "./Selection";
import { PointElement } from "$lib/model/elements/PointElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";

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

	describe("active bend of an arrow", () => {
		const arrow = new ArrowElement(
			"arrow",
			"Pass",
			"black",
			new ArrowGeometry({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ x: 30, y: 30 }, { x: 60, y: 30 }]),
		);

		beforeEach(() => {
			elements.set([a, arrow]);
		});

		it("is none at first and after selecting an element", () => {
			expect(get(selection.selectedBend)).toBeNull();
			selection.select("arrow");
			expect(selection.currentBend()).toBeNull();
		});

		it("selectBend selects the arrow and makes the bend active", () => {
			selection.selectBend("arrow", 1);

			expect(selection.current()).toBe("arrow");
			expect(get(selection.selectedBend)).toBe(1);
		});

		it("selectBend ignores unknown bends, unknown ids and point elements", () => {
			selection.selectBend("arrow", 2);
			selection.selectBend("arrow", -1);
			selection.selectBend("missing", 0);
			selection.selectBend("a", 0);

			expect(selection.current()).toBeNull();
			expect(selection.currentBend()).toBeNull();
		});

		it("selecting (again) and clearing reset the active bend", () => {
			selection.selectBend("arrow", 0);
			selection.select("arrow");
			expect(selection.currentBend()).toBeNull();

			selection.selectBend("arrow", 0);
			selection.clear();
			expect(selection.currentBend()).toBeNull();
		});

		it("clearBend keeps the arrow selected", () => {
			selection.selectBend("arrow", 0);

			selection.clearBend();

			expect(selection.current()).toBe("arrow");
			expect(selection.currentBend()).toBeNull();
		});

		it("is dropped when the arrow loses that bend, and kept while it still has it", () => {
			selection.selectBend("arrow", 1);

			elements.set([a, arrow.withGeometry(arrow.geometry.translate(5, 5))]);
			expect(selection.currentBend()).toBe(1);

			elements.set([a, arrow.withGeometry(arrow.geometry.withBendRemoved(0))]);
			expect(selection.currentBend()).toBeNull();
			expect(selection.current()).toBe("arrow");
		});

		it("is dropped with the arrow", () => {
			selection.selectBend("arrow", 0);

			elements.set([a]);

			expect(selection.current()).toBeNull();
			expect(selection.currentBend()).toBeNull();
		});
	});
});
