import { describe, it, expect } from "vitest";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
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
});
