import { describe, it, expect } from "vitest";
import { get } from "svelte/store";
import { AddElementCommand } from "$lib/commands/AddElementCommand";
import { PointElement } from "$lib/model/elements/PointElement";
import { Frame } from "$lib/model/Frame";
import { CommandHistory } from "./CommandHistory";
import { FrameHistories } from "./FrameHistories";

const add = new AddElementCommand(new PointElement("p1", 0, 0, "red", "Player"));

describe("FrameHistories", () => {
	it("creates a history per frame lazily and returns the same one afterwards", () => {
		const histories = new FrameHistories();

		expect(histories.has("f1")).toBe(false);
		const history = histories.for("f1");

		expect(history).toBeInstanceOf(CommandHistory);
		expect(histories.has("f1")).toBe(true);
		expect(histories.for("f1")).toBe(history);
	});

	it("keeps the histories of different frames independent", () => {
		const histories = new FrameHistories();

		histories.for("f1").execute(add, new Frame("f1", "", []));

		expect(histories.for("f1").canUndo).toBe(true);
		expect(histories.for("f2").canUndo).toBe(false);
		expect(histories.for("f2")).not.toBe(histories.for("f1"));
	});

	it("uses a depth of 200 by default and passes a custom depth on", () => {
		expect(new FrameHistories().for("f").maxDepth).toBe(200);
		expect(new FrameHistories(5).for("f").maxDepth).toBe(5);
	});

	it("clear forgets every history and empties the old ones", () => {
		const histories = new FrameHistories();
		const old = histories.for("f1");
		old.execute(add, new Frame("f1", "", []));

		histories.clear();

		expect(histories.has("f1")).toBe(false);
		expect(get(old.status).canUndo).toBe(false);
		expect(histories.for("f1")).not.toBe(old);
		expect(histories.for("f1").canUndo).toBe(false);
	});

	it("remove forgets and empties one frame's history only", () => {
		const histories = new FrameHistories();
		const removed = histories.for("f1");
		removed.execute(add, new Frame("f1", "", []));
		histories.for("f2").execute(add, new Frame("f2", "", []));

		histories.remove("f1");

		expect(histories.has("f1")).toBe(false);
		expect(get(removed.status).canUndo).toBe(false);
		expect(histories.has("f2")).toBe(true);
		expect(histories.for("f2").canUndo).toBe(true);
	});

	it("remove ignores an unknown frame id", () => {
		const histories = new FrameHistories();

		expect(() => histories.remove("missing")).not.toThrow();
		expect(histories.has("missing")).toBe(false);
	});
});
