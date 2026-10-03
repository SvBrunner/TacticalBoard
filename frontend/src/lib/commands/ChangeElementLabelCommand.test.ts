import { describe, it, expect } from "vitest";
import { CommandHistory } from "$lib/history/CommandHistory";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { ChangeElementColorCommand } from "./ChangeElementColorCommand";
import { ChangeElementLabelCommand } from "./ChangeElementLabelCommand";

const player = new PointElement("p", 10, 20, "red", "Player");
const other = new PointElement("o", 0, 0, "red", "Player", "G");
const frame = new Frame("f", "", [player, other]);

describe("ChangeElementLabelCommand", () => {
	it("of captures the current label", () => {
		const command = ChangeElementLabelCommand.of(other, "C");

		expect(command).toMatchObject({ elementId: "o", from: "G", to: "C" });
		expect(command.label).toBe("Change Player label");
	});

	it("execute relabels only the targeted element and keeps its other fields", () => {
		const result = ChangeElementLabelCommand.of(player, "C").execute(frame);

		expect(result.findElement("p")).toMatchObject({ label: "C", x: 10, y: 20, color: "red", type: "Player" });
		expect(result.findElement("o")).toBe(other);
		expect((frame.findElement("p") as PointElement).label).toBe("");
	});

	it("undo restores the label and redo applies it again", () => {
		const command = ChangeElementLabelCommand.of(other, "LV");

		const undone = command.undo(command.execute(frame));
		expect((undone.findElement("o") as PointElement).label).toBe("G");

		expect((command.execute(undone).findElement("o") as PointElement).label).toBe("LV");
	});

	it("can clear a label", () => {
		const result = ChangeElementLabelCommand.of(other, "").execute(frame);

		expect((result.findElement("o") as PointElement).label).toBe("");
	});

	it("is a no-op when the label is unchanged", () => {
		expect(ChangeElementLabelCommand.of(other, "G").isNoOp(frame)).toBe(true);
		expect(ChangeElementLabelCommand.of(player, "").isNoOp(frame)).toBe(true);
		expect(ChangeElementLabelCommand.of(other, "C").isNoOp(frame)).toBe(false);
	});

	it("is a no-op for an unknown id, and execute/undo leave the frame unchanged", () => {
		const empty = new Frame("f", "", []);
		const command = ChangeElementLabelCommand.of(player, "C");

		expect(command.isNoOp(empty)).toBe(true);
		expect(command.execute(empty)).toBe(empty);
		expect(command.undo(empty)).toBe(empty);
	});

	describe("merging", () => {
		it("merges with the next label change of the same element, keeping the original label", () => {
			const merged = ChangeElementLabelCommand.of(other, "1").mergeWith(
				new ChangeElementLabelCommand("o", "Player", "1", "10"),
			);

			expect(merged).toBeInstanceOf(ChangeElementLabelCommand);
			expect(merged).toMatchObject({ elementId: "o", from: "G", to: "10" });
		});

		it("does not merge with a label change of another element", () => {
			expect(ChangeElementLabelCommand.of(other, "C").mergeWith(ChangeElementLabelCommand.of(player, "C"))).toBeUndefined();
		});

		it("does not merge with other commands", () => {
			expect(ChangeElementLabelCommand.of(other, "C").mergeWith(ChangeElementColorCommand.of(other, "blue"))).toBeUndefined();
		});

		it("keystrokes of one session are one undo step in a history until it is sealed", () => {
			const history = new CommandHistory<Frame>();
			let current = frame;

			current = history.execute(ChangeElementLabelCommand.of(player, "1"), current);
			current = history.execute(new ChangeElementLabelCommand("p", "Player", "1", "10"), current);
			expect(history.undoDepth).toBe(1);

			history.seal();
			current = history.execute(new ChangeElementLabelCommand("p", "Player", "10", "C"), current);
			expect(history.undoDepth).toBe(2);

			current = history.undo(current);
			expect((current.findElement("p") as PointElement).label).toBe("10");
			current = history.undo(current);
			expect((current.findElement("p") as PointElement).label).toBe("");
		});
	});
});
