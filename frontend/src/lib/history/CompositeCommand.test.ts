import { describe, it, expect } from "vitest";
import type { Command } from "./Command";
import { CommandHistory } from "./CommandHistory";
import { CompositeCommand } from "./CompositeCommand";
import { AppendCommand } from "./testCommands";

type Model = readonly number[];

class RecordingCommand implements Command<Model> {
	constructor(
		readonly label: string,
		private readonly log: string[],
		private readonly noOp = false,
	) {}

	execute(model: Model): Model {
		this.log.push(`execute ${this.label}`);
		return model;
	}

	undo(model: Model): Model {
		this.log.push(`undo ${this.label}`);
		return model;
	}

	isNoOp(): boolean {
		return this.noOp;
	}
}

describe("CompositeCommand", () => {
	it("executes its commands in order", () => {
		const composite = new CompositeCommand<Model>("Both", [new AppendCommand(1), new AppendCommand(2)]);

		expect(composite.execute([])).toEqual([1, 2]);
	});

	it("undoes its commands in reverse order", () => {
		const log: string[] = [];
		const composite = new CompositeCommand<Model>("All", [
			new RecordingCommand("a", log),
			new RecordingCommand("b", log),
			new RecordingCommand("c", log),
		]);

		composite.execute([]);
		composite.undo([]);

		expect(log).toEqual(["execute a", "execute b", "execute c", "undo c", "undo b", "undo a"]);
	});

	it("undo restores the model before execute", () => {
		const composite = new CompositeCommand<Model>("Both", [new AppendCommand(1), new AppendCommand(2)]);

		expect(composite.undo(composite.execute([9]))).toEqual([9]);
	});

	it("carries the given label", () => {
		expect(new CompositeCommand<Model>("Paste", []).label).toBe("Paste");
	});

	it("copies the command list", () => {
		const commands: Command<Model>[] = [new AppendCommand(1)];
		const composite = new CompositeCommand<Model>("One", commands);

		commands.push(new AppendCommand(2));

		expect(composite.commands).toHaveLength(1);
	});

	it("is a no-op when empty or when every part is a no-op", () => {
		const log: string[] = [];

		expect(new CompositeCommand<Model>("Empty", []).isNoOp([])).toBe(true);
		expect(
			new CompositeCommand<Model>("None", [new RecordingCommand("a", log, true), new RecordingCommand("b", log, true)]).isNoOp([]),
		).toBe(true);
	});

	it("is not a no-op when any part changes something (parts without isNoOp count as changes)", () => {
		const log: string[] = [];

		expect(
			new CompositeCommand<Model>("Some", [new RecordingCommand("a", log, true), new RecordingCommand("b", log, false)]).isNoOp([]),
		).toBe(false);
		expect(new CompositeCommand<Model>("Plain", [new AppendCommand(1)]).isNoOp([])).toBe(false);
	});

	it("is recorded as a single undo step", () => {
		const history = new CommandHistory<Model>();
		const model = history.execute(new CompositeCommand<Model>("Both", [new AppendCommand(1), new AppendCommand(2)]), []);

		expect(history.undoDepth).toBe(1);
		expect(history.currentStatus().undoLabel).toBe("Both");
		expect(history.undo(model)).toEqual([]);
	});

	it("propagates a failing part without the history recording anything", () => {
		const history = new CommandHistory<Model>();
		const failing: Command<Model> = {
			label: "Fail",
			execute: () => {
				throw new Error("boom");
			},
			undo: (model) => model,
		};

		expect(() => history.execute(new CompositeCommand<Model>("Both", [new AppendCommand(1), failing]), [])).toThrow("boom");
		expect(history.canUndo).toBe(false);
	});
});
