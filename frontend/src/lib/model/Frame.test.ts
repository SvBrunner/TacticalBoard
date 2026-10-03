import { describe, it, expect } from "vitest";
import { PointElement } from "./elements/PointElement";
import { Frame } from "./Frame";
import { SequentialIdGenerator } from "./ids/IdGenerator";

const player = new PointElement("p1", 0, 0, "red", "Player");
const ball = new PointElement("b1", 10, 10, "black", "Ball");

describe("Frame", () => {
	it("createEmpty creates a frame with a generated id, no description, and no elements", () => {
		const frame = Frame.createEmpty(new SequentialIdGenerator("frame-"));

		expect(frame.id).toBe("frame-1");
		expect(frame.description).toBe("");
		expect(frame.elements).toEqual([]);
	});

	describe("addElement", () => {
		it("returns a new frame with the element appended", () => {
			const empty = new Frame("f", "", []);

			const frame = empty.addElement(player).addElement(ball);

			expect(frame.elements).toEqual([player, ball]);
			expect(frame.id).toBe("f");
			expect(empty.elements).toEqual([]);
		});

		it("throws on a duplicate element id", () => {
			const frame = new Frame("f", "", [player]);

			expect(() => frame.addElement(player.withPosition(1, 1))).toThrow(/p1/);
		});
	});

	describe("insertElement", () => {
		const circle = new PointElement("c1", 5, 5, "blue", "Circle");

		it.each([
			[0, ["c1", "p1", "b1"]],
			[1, ["p1", "c1", "b1"]],
			[2, ["p1", "b1", "c1"]],
		])("inserts at index %i", (index, expected) => {
			const frame = new Frame("f", "d", [player, ball]);

			const inserted = frame.insertElement(circle, index);

			expect(inserted.elements.map((element) => element.id)).toEqual(expected);
			expect(inserted).toMatchObject({ id: "f", description: "d" });
			expect(frame.elements).toEqual([player, ball]);
		});

		it.each([
			[-3, ["c1", "p1", "b1"]],
			[99, ["p1", "b1", "c1"]],
		])("clamps the out-of-range index %i", (index, expected) => {
			const frame = new Frame("f", "", [player, ball]);

			expect(frame.insertElement(circle, index).elements.map((element) => element.id)).toEqual(expected);
		});

		it("throws on a duplicate element id", () => {
			const frame = new Frame("f", "", [player]);

			expect(() => frame.insertElement(player, 0)).toThrow(/already contains/);
		});
	});

	describe("indexOfElement", () => {
		it("returns the z-order position of the element", () => {
			const frame = new Frame("f", "", [player, ball]);

			expect(frame.indexOfElement("p1")).toBe(0);
			expect(frame.indexOfElement("b1")).toBe(1);
		});

		it("returns -1 for an unknown id", () => {
			expect(new Frame("f", "", [player]).indexOfElement("missing")).toBe(-1);
		});
	});

	describe("removeElement", () => {
		it("removes only the matching element", () => {
			const frame = new Frame("f", "d", [player, ball]);

			const result = frame.removeElement("p1");

			expect(result.elements).toEqual([ball]);
			expect(result.description).toBe("d");
			expect(frame.elements).toEqual([player, ball]);
		});

		it("returns the same frame for an unknown id", () => {
			const frame = new Frame("f", "", [player]);

			expect(frame.removeElement("missing")).toBe(frame);
		});
	});

	describe("updateElement", () => {
		it("replaces only the matching element", () => {
			const frame = new Frame("f", "", [player, ball]);

			const result = frame.updateElement("p1", (element) => element.withColor("blue"));

			expect(result.elements[0]).toMatchObject({ id: "p1", color: "blue" });
			expect(result.elements[1]).toBe(ball);
			expect(frame.elements[0]).toBe(player);
		});

		it("returns the same frame for an unknown id without calling the update", () => {
			const frame = new Frame("f", "", [player]);
			let called = false;

			const result = frame.updateElement("missing", (element) => {
				called = true;
				return element;
			});

			expect(result).toBe(frame);
			expect(called).toBe(false);
		});

		it("returns the same frame when the update returns the same element", () => {
			const frame = new Frame("f", "", [player]);

			expect(frame.updateElement("p1", (element) => element)).toBe(frame);
		});

		it("throws when the update changes the element id", () => {
			const frame = new Frame("f", "", [player]);

			expect(() => frame.updateElement("p1", () => new PointElement("other", 0, 0, "red", "Player"))).toThrow();
		});
	});

	describe("findElement", () => {
		it("finds an element by id", () => {
			expect(new Frame("f", "", [player, ball]).findElement("b1")).toBe(ball);
		});

		it("returns undefined for an unknown id", () => {
			expect(new Frame("f", "", [player]).findElement("missing")).toBeUndefined();
		});
	});

	it("withDescription returns a new frame with the same id and elements", () => {
		const frame = new Frame("f", "old", [player]);

		const result = frame.withDescription("**new**");

		expect(result).toMatchObject({ id: "f", description: "**new**" });
		expect(result.elements).toEqual([player]);
		expect(frame.description).toBe("old");
	});

	it("withDescription returns the same frame when the description doesn't change", () => {
		const frame = new Frame("f", "same", [player]);

		expect(frame.withDescription("same")).toBe(frame);
	});

	describe("copy", () => {
		it("gets a new frame id but keeps element ids and the description", () => {
			const frame = new Frame("f", "Starting positions", [player, ball]);

			const copy = frame.copy(new SequentialIdGenerator("frame-"));

			expect(copy.id).toBe("frame-1");
			expect(copy.description).toBe("Starting positions");
			expect(copy.elements.map((element) => element.id)).toEqual(["p1", "b1"]);
		});

		it("keeps the elements' labels, and relabeling the copy leaves the original's labels unchanged", () => {
			const labeled = new PointElement("p1", 0, 0, "red", "Player", "C");
			const frame = new Frame("f", "", [labeled, ball]);

			const copy = frame.copy(new SequentialIdGenerator());
			expect((copy.findElement("p1") as PointElement).label).toBe("C");

			const relabeled = copy.updateElement("p1", (element) => (element as PointElement).withLabel("F"));
			expect((relabeled.findElement("p1") as PointElement).label).toBe("F");
			expect((frame.findElement("p1") as PointElement).label).toBe("C");
		});

		it("is independent of the original", () => {
			const frame = new Frame("f", "d", [player]);
			const copy = frame.copy(new SequentialIdGenerator());

			const changedCopy = copy
				.updateElement("p1", (element) => element.withColor("blue"))
				.addElement(ball)
				.withDescription("changed");

			expect(frame.elements).toEqual([player]);
			expect(frame.findElement("p1")?.color).toBe("red");
			expect(frame.description).toBe("d");
			expect(changedCopy.elements).toHaveLength(2);
		});
	});
});
