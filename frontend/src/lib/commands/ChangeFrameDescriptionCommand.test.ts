import { describe, it, expect } from "vitest";
import { CommandHistory } from "$lib/history/CommandHistory";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { ChangeElementLabelCommand } from "./ChangeElementLabelCommand";
import { ChangeFrameDescriptionCommand } from "./ChangeFrameDescriptionCommand";

const player = new PointElement("p", 10, 20, "red", "Player");
const frame = new Frame("f", "Old *text*", [player]);

describe("ChangeFrameDescriptionCommand", () => {
	it("of captures the current description", () => {
		const command = ChangeFrameDescriptionCommand.of(frame, "New");

		expect(command).toMatchObject({ from: "Old *text*", to: "New" });
		expect(command.label).toBe("Change frame description");
	});

	it("execute changes only the description", () => {
		const result = ChangeFrameDescriptionCommand.of(frame, "New").execute(frame);

		expect(result).toMatchObject({ id: "f", description: "New" });
		expect(result.elements).toEqual([player]);
		expect(frame.description).toBe("Old *text*");
	});

	it("undo restores the description and redo applies it again", () => {
		const command = ChangeFrameDescriptionCommand.of(frame, "New");

		const undone = command.undo(command.execute(frame));
		expect(undone.description).toBe("Old *text*");
		expect(command.execute(undone).description).toBe("New");
	});

	it("can clear the description", () => {
		expect(ChangeFrameDescriptionCommand.of(frame, "").execute(frame).description).toBe("");
	});

	it("is a no-op when the description is already the target", () => {
		expect(ChangeFrameDescriptionCommand.of(frame, "Old *text*").isNoOp(frame)).toBe(true);
		expect(ChangeFrameDescriptionCommand.of(frame, "New").isNoOp(frame)).toBe(false);
	});

	it("merges with a following description change, keeping the original text", () => {
		const first = new ChangeFrameDescriptionCommand("a", "ab");
		const merged = first.mergeWith(new ChangeFrameDescriptionCommand("ab", "abc"));

		expect(merged).toBeInstanceOf(ChangeFrameDescriptionCommand);
		expect(merged).toMatchObject({ from: "a", to: "abc" });
	});

	it("does not merge with other commands", () => {
		const first = new ChangeFrameDescriptionCommand("a", "ab");

		expect(first.mergeWith(ChangeElementLabelCommand.of(player, "C"))).toBeUndefined();
	});

	it("one unsealed typing session is one undo step in a history", () => {
		const history = new CommandHistory<Frame>();
		let current = frame;

		current = history.execute(ChangeFrameDescriptionCommand.of(current, "N"), current);
		current = history.execute(ChangeFrameDescriptionCommand.of(current, "Ne"), current);
		current = history.execute(ChangeFrameDescriptionCommand.of(current, "New"), current);
		expect(history.undoDepth).toBe(1);

		current = history.undo(current);
		expect(current.description).toBe("Old *text*");
	});

	it("a sealed history starts a new undo step", () => {
		const history = new CommandHistory<Frame>();
		let current = frame;

		current = history.execute(ChangeFrameDescriptionCommand.of(current, "A"), current);
		history.seal();
		current = history.execute(ChangeFrameDescriptionCommand.of(current, "AB"), current);

		expect(history.undoDepth).toBe(2);
		expect(history.undo(current).description).toBe("A");
	});
});
