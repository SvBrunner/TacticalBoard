import { describe, it, expect } from "vitest";
import { SequentialIdGenerator } from "../ids/IdGenerator";
import { ArrowElement } from "./ArrowElement";
import { ArrowGeometry } from "./ArrowGeometry";
import { BoardElement } from "./BoardElement";

const geometry = new ArrowGeometry({ x: 1, y: 2 }, { x: 30, y: 40 }, [{ x: 10, y: 5 }]);

describe("ArrowElement", () => {
	it("create uses the given fields and an id from the generator", () => {
		const arrow = ArrowElement.create(new SequentialIdGenerator("el-"), "Pass", "black", geometry);

		expect(arrow).toBeInstanceOf(BoardElement);
		expect(arrow).toMatchObject({
			id: "el-1",
			type: "Pass",
			color: "black",
			start: { x: 1, y: 2 },
			end: { x: 30, y: 40 },
			bends: [{ x: 10, y: 5 }],
		});
	});

	it("has no position and no label of its own", () => {
		const arrow = new ArrowElement("a", "Run", "black", geometry);

		expect(arrow).not.toHaveProperty("x");
		expect(arrow).not.toHaveProperty("label");
	});

	it("geometry reflects start, end and bends", () => {
		const arrow = new ArrowElement("a", "Run", "black", geometry);

		expect(arrow.geometry.equals(geometry)).toBe(true);
		expect(arrow.geometry).toBeInstanceOf(ArrowGeometry);
	});

	it("withGeometry returns a reshaped copy with the same id, type and color", () => {
		const arrow = new ArrowElement("a", "Shot", "red", geometry);

		const reshaped = arrow.withGeometry(geometry.straightened());

		expect(reshaped).toMatchObject({ id: "a", type: "Shot", color: "red", bends: [] });
		expect(arrow.bends).toHaveLength(1);
	});

	it("withColor returns a recolored copy and leaves the original unchanged", () => {
		const arrow = new ArrowElement("a", "Pass", "black", geometry);

		const recolored = arrow.withColor("blue");

		expect(recolored).toBeInstanceOf(ArrowElement);
		expect(recolored).toMatchObject({ id: "a", type: "Pass", color: "blue" });
		expect(recolored.geometry.equals(geometry)).toBe(true);
		expect(arrow.color).toBe("black");
	});

	it("withType changes only the arrow type", () => {
		const arrow = new ArrowElement("a", "Pass", "black", geometry);

		const changed = arrow.withType("Run");

		expect(changed).toMatchObject({ id: "a", type: "Run", color: "black" });
		expect(changed.geometry.equals(geometry)).toBe(true);
		expect(arrow.type).toBe("Pass");
	});
});
