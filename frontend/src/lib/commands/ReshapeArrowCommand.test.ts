import { describe, it, expect } from "vitest";
import { CommandHistory } from "$lib/history/CommandHistory";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { MoveElementCommand } from "./MoveElementCommand";
import { ReshapeArrowCommand } from "./ReshapeArrowCommand";

const straight = ArrowGeometry.straight({ x: 0, y: 0 }, { x: 100, y: 0 });
const bent = straight.withBendInserted(0, { x: 50, y: 40 });
const moved = bent.translate(10, 10);
const arrow = new ArrowElement("a", "Pass", "black", straight);
const player = new PointElement("p", 5, 5, "red", "Player");
const frame = new Frame("f", "", [arrow, player]);

function geometryOf(result: Frame, id = "a"): ArrowGeometry {
	return (result.findElement(id) as ArrowElement).geometry;
}

describe("ReshapeArrowCommand", () => {
	it("of captures the arrow's current shape as the start and labels the action", () => {
		const command = ReshapeArrowCommand.of(arrow, bent, "Add bend to");

		expect(command).toMatchObject({ elementId: "a", elementType: "Pass" });
		expect(command.from.equals(straight)).toBe(true);
		expect(command.to.equals(bent)).toBe(true);
		expect(command.label).toBe("Add bend to Pass");
		expect(ReshapeArrowCommand.of(arrow, bent).label).toBe("Reshape Pass");
	});

	it("execute reshapes only the targeted arrow and keeps its type, color and z-order", () => {
		const result = ReshapeArrowCommand.of(arrow, bent).execute(frame);

		expect(geometryOf(result).equals(bent)).toBe(true);
		expect(result.findElement("a")).toMatchObject({ type: "Pass", color: "black" });
		expect(result.findElement("p")).toBe(player);
		expect(result.elements.map((element) => element.id)).toEqual(["a", "p"]);
		expect(geometryOf(frame).equals(straight)).toBe(true);
	});

	it("undo restores the previous shape and redo reshapes again", () => {
		const command = ReshapeArrowCommand.of(arrow, bent);

		const undone = command.undo(command.execute(frame));
		expect(geometryOf(undone).equals(straight)).toBe(true);

		expect(geometryOf(command.execute(undone)).equals(bent)).toBe(true);
	});

	it("is a no-op when the arrow already has the shape", () => {
		expect(ReshapeArrowCommand.of(arrow, ArrowGeometry.straight({ x: 0, y: 0 }, { x: 100, y: 0 })).isNoOp(frame)).toBe(true);
		expect(ReshapeArrowCommand.of(arrow, bent).isNoOp(frame)).toBe(false);
	});

	it("is a no-op for an unknown id or a point element, and execute/undo leave the frame unchanged", () => {
		const empty = new Frame("f", "", []);
		const command = ReshapeArrowCommand.of(arrow, bent);
		const notAnArrow = new ReshapeArrowCommand("p", "Pass", straight, bent);

		expect(command.isNoOp(empty)).toBe(true);
		expect(command.execute(empty)).toBe(empty);
		expect(command.undo(empty)).toBe(empty);
		expect(notAnArrow.isNoOp(frame)).toBe(true);
		expect(notAnArrow.execute(frame)).toBe(frame);
	});

	describe("mergeWith", () => {
		it("absorbs a later reshape of the same arrow, keeping the original shape and label", () => {
			const first = ReshapeArrowCommand.of(arrow, bent, "Add bend to");
			const second = new ReshapeArrowCommand("a", "Pass", bent, moved, "Move");

			const merged = first.mergeWith(second);

			expect(merged).toBeInstanceOf(ReshapeArrowCommand);
			expect(merged?.label).toBe("Add bend to Pass");
			expect(geometryOf(merged!.execute(frame)).equals(moved)).toBe(true);
			expect(geometryOf(merged!.undo(merged!.execute(frame))).equals(straight)).toBe(true);
		});

		it("does not merge with a reshape of another arrow or another command type", () => {
			const command = ReshapeArrowCommand.of(arrow, bent);

			expect(command.mergeWith(new ReshapeArrowCommand("b", "Pass", straight, bent))).toBeUndefined();
			expect(command.mergeWith(MoveElementCommand.of(player, 1, 1))).toBeUndefined();
		});

		it("in a history: one gesture is one undo step, a sealed history starts a new one", () => {
			const history = new CommandHistory<Frame>();
			let current = frame;
			current = history.execute(ReshapeArrowCommand.of(arrow, bent), current);
			current = history.execute(new ReshapeArrowCommand("a", "Pass", bent, moved), current);
			history.seal();
			current = history.execute(new ReshapeArrowCommand("a", "Pass", moved, straight, "Straighten"), current);

			expect(history.currentStatus().undoLabel).toBe("Straighten Pass");
			current = history.undo(current);
			expect(geometryOf(current).equals(moved)).toBe(true);
			current = history.undo(current);
			expect(geometryOf(current).equals(straight)).toBe(true);
			expect(history.currentStatus().canUndo).toBe(false);
		});
	});
});
