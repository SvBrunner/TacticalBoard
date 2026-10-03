import { describe, it, expect } from "vitest";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { AddElementCommand } from "./AddElementCommand";

const existing = new PointElement("p1", 0, 0, "red", "Player");
const ball = new PointElement("b1", 5, 5, "black", "Ball");

describe("AddElementCommand", () => {
	it("is labelled with the element type", () => {
		expect(new AddElementCommand(ball).label).toBe("Add Ball");
	});

	it("execute appends the element on top", () => {
		const frame = new Frame("f", "", [existing]);

		const result = new AddElementCommand(ball).execute(frame);

		expect(result.elements).toEqual([existing, ball]);
		expect(frame.elements).toEqual([existing]);
	});

	it("undo removes the element by id", () => {
		const command = new AddElementCommand(ball);

		const result = command.undo(command.execute(new Frame("f", "", [existing])));

		expect(result.elements).toEqual([existing]);
	});

	it("redo re-adds the same element with the same id", () => {
		const command = new AddElementCommand(ball);
		const frame = new Frame("f", "", []);

		const redone = command.execute(command.undo(command.execute(frame)));

		expect(redone.elements).toEqual([ball]);
		expect(redone.elements[0]).toBe(ball);
		expect(redone.elements[0].id).toBe("b1");
	});

	it("is never a no-op", () => {
		expect(new AddElementCommand(ball).isNoOp()).toBe(false);
	});

	it("execute throws when the frame already contains the id", () => {
		expect(() => new AddElementCommand(existing).execute(new Frame("f", "", [existing]))).toThrow(/already contains/);
	});

	it("undo leaves the frame unchanged when the element is unknown", () => {
		const frame = new Frame("f", "", [existing]);

		expect(new AddElementCommand(ball).undo(frame)).toBe(frame);
	});
});
