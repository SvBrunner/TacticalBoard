import { describe, it, expect } from "vitest";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { ChangeElementColorCommand } from "./ChangeElementColorCommand";

const player = new PointElement("p", 10, 20, "red", "Player");
const other = new PointElement("o", 0, 0, "red", "Player");
const frame = new Frame("f", "", [player, other]);

describe("ChangeElementColorCommand", () => {
	it("of captures the current color", () => {
		const command = ChangeElementColorCommand.of(player, "green");

		expect(command).toMatchObject({ elementId: "p", from: "red", to: "green" });
		expect(command.label).toBe("Change Player color");
	});

	it("execute recolors only the targeted element", () => {
		const result = ChangeElementColorCommand.of(player, "green").execute(frame);

		expect(result.findElement("p")).toMatchObject({ color: "green", x: 10, y: 20, type: "Player" });
		expect(result.findElement("o")).toBe(other);
		expect(frame.findElement("p")?.color).toBe("red");
	});

	it("undo restores the color and redo applies it again", () => {
		const command = ChangeElementColorCommand.of(player, "green");

		const undone = command.undo(command.execute(frame));
		expect(undone.findElement("p")?.color).toBe("red");

		expect(command.execute(undone).findElement("p")?.color).toBe("green");
	});

	it("is a no-op when the color is unchanged", () => {
		expect(ChangeElementColorCommand.of(player, "red").isNoOp(frame)).toBe(true);
		expect(ChangeElementColorCommand.of(player, "green").isNoOp(frame)).toBe(false);
	});

	it("is a no-op for an unknown id, and execute/undo leave the frame unchanged", () => {
		const empty = new Frame("f", "", []);
		const command = ChangeElementColorCommand.of(player, "green");

		expect(command.isNoOp(empty)).toBe(true);
		expect(command.execute(empty)).toBe(empty);
		expect(command.undo(empty)).toBe(empty);
	});

	it("does not merge", () => {
		expect("mergeWith" in ChangeElementColorCommand.of(player, "green")).toBe(false);
	});
});
