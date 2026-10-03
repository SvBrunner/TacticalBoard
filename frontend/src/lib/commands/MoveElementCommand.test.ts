import { describe, it, expect } from "vitest";
import { AddElementCommand } from "./AddElementCommand";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { MoveElementCommand } from "./MoveElementCommand";

const player = new PointElement("p", 10, 20, "red", "Player");
const other = new PointElement("o", 0, 0, "black", "Ball");
const frame = new Frame("f", "", [player, other]);

describe("MoveElementCommand", () => {
	it("of captures the element's current position as the start", () => {
		const command = MoveElementCommand.of(player, 30, 40);

		expect(command).toMatchObject({ elementId: "p", elementType: "Player", from: { x: 10, y: 20 }, to: { x: 30, y: 40 } });
		expect(command.label).toBe("Move Player");
	});

	it("execute moves only the targeted element", () => {
		const result = MoveElementCommand.of(player, 30, 40).execute(frame);

		expect(result.findElement("p")).toMatchObject({ x: 30, y: 40, color: "red", type: "Player" });
		expect(result.findElement("o")).toBe(other);
		expect(frame.findElement("p")).toBe(player);
	});

	it("undo moves the element back and redo moves it again", () => {
		const command = MoveElementCommand.of(player, 30, 40);

		const undone = command.undo(command.execute(frame));
		expect(undone.findElement("p")).toMatchObject({ x: 10, y: 20 });

		expect(command.execute(undone).findElement("p")).toMatchObject({ x: 30, y: 40 });
	});

	it("keeps the z-order", () => {
		const result = MoveElementCommand.of(player, 1, 1).execute(frame);

		expect(result.elements.map((element) => element.id)).toEqual(["p", "o"]);
	});

	it("is a no-op when the element is already at the target", () => {
		expect(MoveElementCommand.of(player, 10, 20).isNoOp(frame)).toBe(true);
		expect(MoveElementCommand.of(player, 10, 21).isNoOp(frame)).toBe(false);
	});

	it("is a no-op for an unknown id, and execute/undo leave the frame unchanged", () => {
		const empty = new Frame("f", "", []);
		const command = MoveElementCommand.of(player, 1, 1);

		expect(command.isNoOp(empty)).toBe(true);
		expect(command.execute(empty)).toBe(empty);
		expect(command.undo(empty)).toBe(empty);
	});

	describe("mergeWith", () => {
		it("absorbs a later move of the same element, keeping the original start", () => {
			const first = MoveElementCommand.of(player, 30, 40);
			const second = new MoveElementCommand("p", "Player", { x: 30, y: 40 }, { x: 50, y: 60 });

			const merged = first.mergeWith(second);

			expect(merged).toBeInstanceOf(MoveElementCommand);
			expect(merged).toMatchObject({ elementId: "p", from: { x: 10, y: 20 }, to: { x: 50, y: 60 } });
			expect(merged?.undo(merged.execute(frame)).findElement("p")).toMatchObject({ x: 10, y: 20 });
		});

		it("does not merge with a move of another element", () => {
			expect(MoveElementCommand.of(player, 1, 1).mergeWith(MoveElementCommand.of(other, 1, 1))).toBeUndefined();
		});

		it("does not merge with other command types", () => {
			expect(MoveElementCommand.of(player, 1, 1).mergeWith(new AddElementCommand(other))).toBeUndefined();
		});
	});
});
