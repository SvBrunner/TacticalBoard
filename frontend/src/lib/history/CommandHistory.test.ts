import { describe, it, expect, beforeEach } from "vitest";
import { get } from "svelte/store";
import type { Command } from "./Command";
import { CommandHistory, DEFAULT_MAX_HISTORY_DEPTH } from "./CommandHistory";
import { EMPTY_HISTORY_STATUS, type HistoryStatus } from "./HistoryStatus";
import { AppendCommand } from "./testCommands";

type Model = readonly number[];

/** Sets the last value; merges with a following SetLast (keeping the original "before"). */
class SetLastCommand implements Command<Model> {
	readonly label = "Set last";

	constructor(
		readonly from: number,
		readonly to: number,
	) {}

	execute(model: Model): Model {
		return [...model.slice(0, -1), this.to];
	}

	undo(model: Model): Model {
		return [...model.slice(0, -1), this.from];
	}

	isNoOp(model: Model): boolean {
		return model.at(-1) === this.to;
	}

	mergeWith(next: Command<Model>): Command<Model> | undefined {
		return next instanceof SetLastCommand ? new SetLastCommand(this.from, next.to) : undefined;
	}
}

class ThrowingCommand implements Command<Model> {
	readonly label = "Throwing";

	constructor(
		private readonly throwOnExecute = true,
		private readonly throwOnUndo = false,
	) {}

	execute(model: Model): Model {
		if (this.throwOnExecute) {
			throw new Error("execute failed");
		}
		return [...model, 0];
	}

	undo(model: Model): Model {
		if (this.throwOnUndo) {
			throw new Error("undo failed");
		}
		return model.slice(0, -1);
	}
}

describe("CommandHistory", () => {
	let history: CommandHistory<Model>;

	beforeEach(() => {
		history = new CommandHistory<Model>();
	});

	it("starts empty", () => {
		expect(history.canUndo).toBe(false);
		expect(history.canRedo).toBe(false);
		expect(history.undoDepth).toBe(0);
		expect(history.redoDepth).toBe(0);
		expect(history.currentStatus()).toEqual(EMPTY_HISTORY_STATUS);
		expect(get(history.status)).toEqual(EMPTY_HISTORY_STATUS);
	});

	it("defaults to a depth of 200", () => {
		expect(DEFAULT_MAX_HISTORY_DEPTH).toBe(200);
		expect(history.maxDepth).toBe(200);
	});

	it.each([[0], [-1], [1.5], [Number.NaN]])("rejects the invalid maxDepth %s", (maxDepth) => {
		expect(() => new CommandHistory<Model>(maxDepth)).toThrow(/maxDepth/);
	});

	it("execute applies the command and makes it undoable", () => {
		const model = history.execute(new AppendCommand(1), []);

		expect(model).toEqual([1]);
		expect(history.currentStatus()).toEqual({ canUndo: true, canRedo: false, undoLabel: "Append 1", redoLabel: undefined });
	});

	it("does not mutate the model it is given", () => {
		const initial: Model = Object.freeze([]);

		expect(() => history.execute(new AppendCommand(1), initial)).not.toThrow();
		expect(initial).toEqual([]);
	});

	it("undo reverts and redo re-applies", () => {
		let model = history.execute(new AppendCommand(1), []);

		model = history.undo(model);
		expect(model).toEqual([]);
		expect(history.currentStatus()).toEqual({ canUndo: false, canRedo: true, undoLabel: undefined, redoLabel: "Append 1" });

		model = history.redo(model);
		expect(model).toEqual([1]);
		expect(history.currentStatus()).toEqual({ canUndo: true, canRedo: false, undoLabel: "Append 1", redoLabel: undefined });
	});

	it("undoes and redoes in LIFO order", () => {
		let model: Model = [];
		for (const value of [1, 2, 3]) {
			model = history.execute(new AppendCommand(value), model);
		}

		model = history.undo(model);
		expect(model).toEqual([1, 2]);
		model = history.undo(model);
		expect(model).toEqual([1]);
		expect(history.currentStatus().redoLabel).toBe("Append 2");

		model = history.redo(model);
		expect(model).toEqual([1, 2]);
		model = history.redo(model);
		expect(model).toEqual([1, 2, 3]);
		expect(history.canRedo).toBe(false);
	});

	it("undo and redo return the model unchanged when there is nothing to do", () => {
		const model: Model = [7];

		expect(history.undo(model)).toBe(model);
		expect(history.redo(model)).toBe(model);
	});

	it("a new command clears the redo stack", () => {
		let model = history.execute(new AppendCommand(1), []);
		model = history.execute(new AppendCommand(2), model);
		model = history.undo(model);

		model = history.execute(new AppendCommand(3), model);

		expect(model).toEqual([1, 3]);
		expect(history.canRedo).toBe(false);
		expect(history.redo(model)).toBe(model);
	});

	describe("no-op commands", () => {
		it("are neither executed nor recorded", () => {
			const model: Model = [5];

			const result = history.execute(new SetLastCommand(5, 5), model);

			expect(result).toBe(model);
			expect(history.canUndo).toBe(false);
		});

		it("do not clear the redo stack", () => {
			let model = history.execute(new AppendCommand(1), []);
			model = history.undo(model);

			history.execute(new SetLastCommand(1, model.at(-1) as number), model);

			expect(history.canRedo).toBe(true);
		});

		it("are treated as real commands when isNoOp is not implemented", () => {
			history.execute(new AppendCommand(1), []);

			expect(history.canUndo).toBe(true);
		});
	});

	describe("merging and sealing", () => {
		it("merges consecutive mergeable commands into one step keeping the original before", () => {
			let model = history.execute(new SetLastCommand(0, 1), [0]);
			model = history.execute(new SetLastCommand(1, 2), model);
			model = history.execute(new SetLastCommand(2, 3), model);

			expect(model).toEqual([3]);
			expect(history.undoDepth).toBe(1);
			expect(history.undo(model)).toEqual([0]);
		});

		it("does not merge after seal()", () => {
			let model = history.execute(new SetLastCommand(0, 1), [0]);
			history.seal();
			model = history.execute(new SetLastCommand(1, 2), model);

			expect(history.undoDepth).toBe(2);
			expect(history.undo(model)).toEqual([1]);
		});

		it("unseals again after the next command, so later commands merge with it", () => {
			let model = history.execute(new SetLastCommand(0, 1), [0]);
			history.seal();
			model = history.execute(new SetLastCommand(1, 2), model);
			model = history.execute(new SetLastCommand(2, 3), model);

			expect(history.undoDepth).toBe(2);
			expect(history.undo(model)).toEqual([1]);
		});

		it("does not merge when mergeWith declines", () => {
			let model = history.execute(new SetLastCommand(0, 1), [0]);
			model = history.execute(new AppendCommand(9), model);

			expect(history.undoDepth).toBe(2);
		});

		it("does not merge into a command without mergeWith", () => {
			let model = history.execute(new AppendCommand(1), []);
			model = history.execute(new SetLastCommand(1, 2), model);

			expect(history.undoDepth).toBe(2);
		});

		it("undo seals: a command after undo does not merge into the remaining step", () => {
			let model = history.execute(new SetLastCommand(0, 1), [0]);
			history.seal();
			model = history.execute(new SetLastCommand(1, 2), model);
			model = history.undo(model);

			model = history.execute(new SetLastCommand(1, 5), model);

			expect(history.undoDepth).toBe(2);
			expect(history.undo(model)).toEqual([1]);
		});

		it("redo seals: a command after redo does not merge into the redone step", () => {
			let model = history.execute(new SetLastCommand(0, 1), [0]);
			model = history.undo(model);
			model = history.redo(model);

			model = history.execute(new SetLastCommand(1, 2), model);

			expect(history.undoDepth).toBe(2);
		});
	});

	describe("throw safety", () => {
		it("does not record a command whose execute throws", () => {
			const model = history.execute(new AppendCommand(1), []);

			expect(() => history.execute(new ThrowingCommand(), model)).toThrow("execute failed");

			expect(history.undoDepth).toBe(1);
			expect(history.currentStatus().undoLabel).toBe("Append 1");
		});

		it("keeps the redo stack when a new command throws", () => {
			let model = history.execute(new AppendCommand(1), []);
			model = history.undo(model);

			expect(() => history.execute(new ThrowingCommand(), model)).toThrow();

			expect(history.canRedo).toBe(true);
		});

		it("keeps the stacks unchanged when undo throws", () => {
			const model = history.execute(new ThrowingCommand(false, true), []);

			expect(() => history.undo(model)).toThrow("undo failed");

			expect(history.undoDepth).toBe(1);
			expect(history.redoDepth).toBe(0);
		});

		it("keeps the stacks unchanged when redo throws", () => {
			const command = new AppendCommand(1);
			let model = history.execute(command, []);
			model = history.undo(model);
			command.execute = () => {
				throw new Error("redo failed");
			};

			expect(() => history.redo(model)).toThrow("redo failed");

			expect(history.undoDepth).toBe(0);
			expect(history.redoDepth).toBe(1);
		});

		it("stays usable after a command threw", () => {
			expect(() => history.execute(new ThrowingCommand(), [])).toThrow();

			expect(history.execute(new AppendCommand(1), [])).toEqual([1]);
		});
	});

	it("drops the oldest steps beyond maxDepth", () => {
		const small = new CommandHistory<Model>(3);
		let model: Model = [];
		for (const value of [1, 2, 3, 4, 5]) {
			model = small.execute(new AppendCommand(value), model);
		}

		expect(small.undoDepth).toBe(3);
		model = small.undo(small.undo(small.undo(model)));
		expect(model).toEqual([1, 2]);
		expect(small.canUndo).toBe(false);
	});

	it("keeps exactly 200 steps by default", () => {
		let model: Model = [];
		for (let value = 0; value < 250; value += 1) {
			model = history.execute(new AppendCommand(value), model);
		}

		expect(history.undoDepth).toBe(200);
	});

	it("clear forgets undo and redo steps", () => {
		let model = history.execute(new AppendCommand(1), []);
		model = history.execute(new AppendCommand(2), model);
		model = history.undo(model);

		history.clear();

		expect(history.currentStatus()).toEqual(EMPTY_HISTORY_STATUS);
		expect(history.undo(model)).toBe(model);
	});

	it("clear seals, so the next command does not merge into anything", () => {
		history.execute(new SetLastCommand(0, 1), [0]);
		history.clear();

		history.execute(new SetLastCommand(1, 2), [1]);

		expect(history.undoDepth).toBe(1);
	});

	describe("re-entrancy", () => {
		class ReentrantCommand implements Command<Model> {
			readonly label = "Reentrant";

			constructor(
				private readonly history: CommandHistory<Model>,
				private readonly call: (history: CommandHistory<Model>, model: Model) => void,
			) {}

			execute(model: Model): Model {
				this.call(this.history, model);
				return model;
			}

			undo(model: Model): Model {
				return model;
			}
		}

		it.each([
			["execute", (h: CommandHistory<Model>, m: Model) => h.execute(new AppendCommand(1), m)],
			["undo", (h: CommandHistory<Model>, m: Model) => h.undo(m)],
			["redo", (h: CommandHistory<Model>, m: Model) => h.redo(m)],
		])("rejects %s while a command runs and records nothing", (_name, call) => {
			expect(() => history.execute(new ReentrantCommand(history, call), [])).toThrow(/re-entrant/);
			expect(history.undoDepth).toBe(0);
		});

		it("accepts calls again after the rejected one", () => {
			expect(() =>
				history.execute(new ReentrantCommand(history, (h, m) => h.undo(m)), []),
			).toThrow();

			expect(history.execute(new AppendCommand(1), [])).toEqual([1]);
		});
	});

	describe("status store", () => {
		it("notifies subscribers on execute, undo, redo, and clear", () => {
			const seen: HistoryStatus[] = [];
			const unsubscribe = history.status.subscribe((status) => seen.push(status));

			let model = history.execute(new AppendCommand(1), []);
			model = history.undo(model);
			model = history.redo(model);
			history.clear();
			unsubscribe();

			expect(seen.map((status) => [status.canUndo, status.canRedo])).toEqual([
				[false, false],
				[true, false],
				[false, true],
				[true, false],
				[false, false],
			]);
		});

		it("does not notify for no-ops or empty undo/redo", () => {
			const seen: HistoryStatus[] = [];
			const unsubscribe = history.status.subscribe((status) => seen.push(status));

			history.execute(new SetLastCommand(1, 1), [1]);
			history.undo([]);
			history.redo([]);
			unsubscribe();

			expect(seen).toHaveLength(1);
		});

		it("publishes the label of a merged step", () => {
			let model = history.execute(new AppendCommand(0), []);
			model = history.execute(new SetLastCommand(0, 1), model);
			history.execute(new SetLastCommand(1, 2), model);

			expect(get(history.status).undoLabel).toBe("Set last");
		});
	});
});
