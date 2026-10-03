import { describe, it, expect } from "vitest";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { RemoveElementCommand } from "./RemoveElementCommand";

const a = new PointElement("a", 0, 0, "red", "Player");
const b = new PointElement("b", 1, 1, "black", "Ball");
const c = new PointElement("c", 2, 2, "grey", "Circle");
const frame = new Frame("f", "", [a, b, c]);

const ids = (f: Frame) => f.elements.map((element) => element.id);

describe("RemoveElementCommand", () => {
	it("of captures the element and its z-order index", () => {
		const command = RemoveElementCommand.of(frame, "b");

		expect(command?.element).toBe(b);
		expect(command?.index).toBe(1);
		expect(command?.label).toBe("Delete Ball");
	});

	it("of returns undefined for an unknown id", () => {
		expect(RemoveElementCommand.of(frame, "missing")).toBeUndefined();
	});

	it("execute removes the element by id", () => {
		const command = RemoveElementCommand.of(frame, "b")!;

		expect(ids(command.execute(frame))).toEqual(["a", "c"]);
		expect(ids(frame)).toEqual(["a", "b", "c"]);
	});

	it.each([["a"], ["b"], ["c"]])("undo restores %s at its original z-order position", (id) => {
		const command = RemoveElementCommand.of(frame, id)!;

		const restored = command.undo(command.execute(frame));

		expect(ids(restored)).toEqual(["a", "b", "c"]);
		expect(restored.findElement(id)).toBe(frame.findElement(id));
	});

	it("redo removes the same element again", () => {
		const command = RemoveElementCommand.of(frame, "a")!;

		const redone = command.execute(command.undo(command.execute(frame)));

		expect(ids(redone)).toEqual(["b", "c"]);
	});

	it("is a no-op when the element is not in the frame", () => {
		const command = new RemoveElementCommand(b, 1);

		expect(command.isNoOp(new Frame("f", "", [a]))).toBe(true);
		expect(command.isNoOp(frame)).toBe(false);
	});

	it("execute leaves the frame unchanged for an unknown id", () => {
		const other = new Frame("f", "", [a]);

		expect(new RemoveElementCommand(b, 1).execute(other)).toBe(other);
	});
});
