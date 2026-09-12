import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import { Board, BoardElement } from "./Board";

describe("BoardElement.create", () => {
	it("creates an element with the given fields and a generated id", () => {
		const element = BoardElement.create(1, 2, "red", "Player");

		expect(element.x).toBe(1);
		expect(element.y).toBe(2);
		expect(element.color).toBe("red");
		expect(element.type).toBe("Player");
		expect(element.id).toBeTruthy();
	});

	it("generates a different id for each element", () => {
		const a = BoardElement.create(0, 0, "red", "Player");
		const b = BoardElement.create(0, 0, "red", "Player");

		expect(a.id).not.toBe(b.id);
	});
});

describe("Board", () => {
	let board: Board;

	beforeEach(() => {
		board = new Board();
	});

	it("starts empty", () => {
		expect(get(board.elements)).toEqual([]);
	});

	it("addElement appends a new element", () => {
		board.addElement(10, 20, "blue", "Ball");

		const elements = get(board.elements);
		expect(elements).toHaveLength(1);
		expect(elements[0]).toMatchObject({ x: 10, y: 20, color: "blue", type: "Ball" });
	});

	it("removeElement removes only the matching element", () => {
		board.addElement(0, 0, "blue", "Player");
		board.addElement(1, 1, "red", "Player");
		const [first, second] = get(board.elements);

		board.removeElement(first.id);

		const remaining = get(board.elements);
		expect(remaining).toHaveLength(1);
		expect(remaining[0].id).toBe(second.id);
	});

	it("moveElement updates x and y for the matching element only", () => {
		board.addElement(0, 0, "blue", "Player");
		board.addElement(0, 0, "blue", "Player");
		const [first, second] = get(board.elements);

		board.moveElement(first.id, 5, 6);

		const [movedFirst, untouchedSecond] = get(board.elements);
		expect(movedFirst).toMatchObject({ x: 5, y: 6 });
		expect(untouchedSecond).toMatchObject({ x: 0, y: 0 });
		expect(second.id).toBe(untouchedSecond.id);
	});

	it("changeColor updates only the matching element's color", () => {
		board.addElement(0, 0, "blue", "Player");
		const [element] = get(board.elements);

		board.changeColor(element.id, "green");

		expect(get(board.elements)[0].color).toBe("green");
	});

	it("changeType updates only the matching element's type", () => {
		board.addElement(0, 0, "blue", "Player");
		const [element] = get(board.elements);

		board.changeType(element.id, "Circle");

		expect(get(board.elements)[0].type).toBe("Circle");
	});

	it("moveElement/changeColor/changeType are no-ops for an unknown id", () => {
		board.addElement(0, 0, "blue", "Player");
		const before = get(board.elements);

		board.moveElement("missing", 9, 9);
		board.changeColor("missing", "green");
		board.changeType("missing", "Circle");

		expect(get(board.elements)).toEqual(before);
	});

	it("serialize round-trips through loadFromJson", () => {
		board.addElement(3, 4, "blue", "Rectangle");
		const json = board.serialize();

		const restored = new Board();
		restored.loadFromJson(json);

		expect(get(restored.elements)).toEqual(get(board.elements));
	});
});
