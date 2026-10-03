import { describe, it, expect } from "vitest";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { ChangeElementTypeCommand } from "./ChangeElementTypeCommand";

const player = new PointElement("p", 10, 20, "red", "Player");
const other = new PointElement("o", 0, 0, "red", "Player");
const frame = new Frame("f", "", [player, other]);

describe("ChangeElementTypeCommand", () => {
	it("of captures the current type", () => {
		const command = ChangeElementTypeCommand.of(player, "Circle");

		expect(command).toMatchObject({ elementId: "p", from: "Player", to: "Circle" });
		expect(command.label).toBe("Change Player to Circle");
	});

	it("execute changes only the targeted element's type, keeping id, position, and color", () => {
		const result = ChangeElementTypeCommand.of(player, "Circle").execute(frame);

		expect(result.findElement("p")).toMatchObject({ id: "p", type: "Circle", x: 10, y: 20, color: "red" });
		expect(result.findElement("o")).toBe(other);
		expect(result.elements.map((element) => element.id)).toEqual(["p", "o"]);
	});

	it("undo restores the type and redo applies it again", () => {
		const command = ChangeElementTypeCommand.of(player, "Ball");

		const undone = command.undo(command.execute(frame));
		expect(undone.findElement("p")?.type).toBe("Player");

		expect(command.execute(undone).findElement("p")?.type).toBe("Ball");
	});

	it("is a no-op when the type is unchanged", () => {
		expect(ChangeElementTypeCommand.of(player, "Player").isNoOp(frame)).toBe(true);
		expect(ChangeElementTypeCommand.of(player, "Triangle").isNoOp(frame)).toBe(false);
	});

	it("is a no-op for an unknown id, and execute/undo leave the frame unchanged", () => {
		const empty = new Frame("f", "", []);
		const command = ChangeElementTypeCommand.of(player, "Circle");

		expect(command.isNoOp(empty)).toBe(true);
		expect(command.execute(empty)).toBe(empty);
		expect(command.undo(empty)).toBe(empty);
	});

	it("keeps a point element's label", () => {
		const labeled = new PointElement("l", 0, 0, "red", "Player", "C");
		const result = ChangeElementTypeCommand.of(labeled, "Ball").execute(new Frame("f", "", [labeled]));

		expect(result.findElement("l")).toMatchObject({ type: "Ball", label: "C" });
	});

	describe("arrows", () => {
		const geometry = new ArrowGeometry({ x: 1, y: 2 }, { x: 30, y: 40 }, [{ x: 10, y: 5 }]);
		const pass = new ArrowElement("a", "Pass", "black", geometry);
		const arrowFrame = new Frame("f", "", [pass, player]);

		it("changes an arrow's type, keeping its id, shape and color", () => {
			const command = ChangeElementTypeCommand.of(pass, "Shot");
			const result = command.execute(arrowFrame);

			expect(command.label).toBe("Change Pass to Shot");
			expect(result.findElement("a")).toBeInstanceOf(ArrowElement);
			expect(result.findElement("a")).toMatchObject({ id: "a", type: "Shot", color: "black" });
			expect((result.findElement("a") as ArrowElement).geometry.equals(geometry)).toBe(true);
			expect(command.undo(result).findElement("a")?.type).toBe("Pass");
		});

		it("is a no-op when the arrow already has the type", () => {
			expect(ChangeElementTypeCommand.of(pass, "Pass").isNoOp(arrowFrame)).toBe(true);
			expect(ChangeElementTypeCommand.of(pass, "Run").isNoOp(arrowFrame)).toBe(false);
		});
	});

	describe("families", () => {
		it("refuses to change a point type into an arrow type and vice versa", () => {
			expect(() => new ChangeElementTypeCommand("p", "Player", "Pass")).toThrow(/family/);
			expect(() => new ChangeElementTypeCommand("a", "Shot", "Circle")).toThrow(/family/);
		});

		it("is a no-op (and changes nothing) when the element in the frame is of the other family", () => {
			const pass = new ArrowElement("p", "Pass", "black", ArrowGeometry.straight({ x: 0, y: 0 }, { x: 9, y: 9 }));
			const mixed = new Frame("f", "", [pass]);
			const command = new ChangeElementTypeCommand("p", "Player", "Circle");

			expect(command.isNoOp(mixed)).toBe(true);
			expect(command.execute(mixed).findElement("p")).toMatchObject({ type: "Pass" });
		});
	});
});
