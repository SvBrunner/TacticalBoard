import { describe, it, expect } from "vitest";
import { SequentialIdGenerator } from "../ids/IdGenerator";
import { BoardElement } from "./BoardElement";
import { PointElement } from "./PointElement";

describe("PointElement", () => {
	it("create uses the given fields and an id from the generator", () => {
		const element = PointElement.create(new SequentialIdGenerator("el-"), 1, 2, "red", "Player");

		expect(element).toBeInstanceOf(BoardElement);
		expect(element).toMatchObject({ id: "el-1", x: 1, y: 2, color: "red", type: "Player" });
	});

	it("create generates a different id for each element", () => {
		const ids = new SequentialIdGenerator();

		expect(PointElement.create(ids, 0, 0, "red", "Player").id).not.toBe(
			PointElement.create(ids, 0, 0, "red", "Player").id,
		);
	});

	it("withPosition returns a moved copy with the same id and leaves the original unchanged", () => {
		const original = new PointElement("e", 0, 0, "red", "Ball");

		const moved = original.withPosition(5, 6);

		expect(moved).not.toBe(original);
		expect(moved).toMatchObject({ id: "e", x: 5, y: 6, color: "red", type: "Ball" });
		expect(original).toMatchObject({ x: 0, y: 0 });
	});

	it("withColor returns a recolored copy with the same id and leaves the original unchanged", () => {
		const original = new PointElement("e", 1, 2, "red", "Player");

		const recolored = original.withColor("green");

		expect(recolored).toMatchObject({ id: "e", x: 1, y: 2, color: "green", type: "Player" });
		expect(original.color).toBe("red");
	});

	it("withType keeps the id, position, and color and leaves the original unchanged", () => {
		const original = new PointElement("e", 1, 2, "red", "Player");

		const changed = original.withType("Circle");

		expect(changed).toMatchObject({ id: "e", x: 1, y: 2, color: "red", type: "Circle" });
		expect(original.type).toBe("Player");
	});
});
