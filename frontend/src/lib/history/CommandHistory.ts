import { writable, type Readable, type Writable } from "svelte/store";
import type { Command } from "./Command";
import { EMPTY_HISTORY_STATUS, type HistoryStatus } from "./HistoryStatus";

/** Default number of undo steps kept; older steps are dropped. */
export const DEFAULT_MAX_HISTORY_DEPTH = 200;

/**
 * Undo/redo stacks of commands for one immutable model. The history does
 * not hold the model itself: callers pass the current model in and get the
 * changed model back.
 *
 * - No-op commands are not recorded; a new command clears the redo stack.
 * - A command that throws is not recorded and the stacks stay unchanged.
 * - Until `seal()` is called, a new command may merge into the previous
 *   one (`Command.mergeWith`), so e.g. one text edit session is one step.
 *   Undo and redo seal the history.
 * - Calls made while a command runs (re-entrant calls) are rejected.
 */
export class CommandHistory<TModel> {
	private undoStack: Command<TModel>[] = [];
	private redoStack: Command<TModel>[] = [];
	private sealed = true;
	private running = false;
	private readonly statusStore: Writable<HistoryStatus> = writable(EMPTY_HISTORY_STATUS);

	readonly status: Readable<HistoryStatus> = { subscribe: this.statusStore.subscribe };

	constructor(readonly maxDepth: number = DEFAULT_MAX_HISTORY_DEPTH) {
		if (!Number.isInteger(maxDepth) || maxDepth < 1) {
			throw new Error(`maxDepth must be a positive integer (got ${maxDepth})`);
		}
	}

	get canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	get canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	get undoDepth(): number {
		return this.undoStack.length;
	}

	get redoDepth(): number {
		return this.redoStack.length;
	}

	currentStatus(): HistoryStatus {
		return {
			canUndo: this.canUndo,
			canRedo: this.canRedo,
			undoLabel: this.undoStack.at(-1)?.label,
			redoLabel: this.redoStack.at(-1)?.label,
		};
	}

	/** Executes and records `command`; returns the changed model (or `model` itself for a no-op). */
	execute(command: Command<TModel>, model: TModel): TModel {
		return this.guarded(() => {
			if (command.isNoOp?.(model)) {
				return model;
			}
			const result = command.execute(model);
			this.record(command);
			return result;
		});
	}

	/** Reverts the most recent command; returns `model` unchanged when there is nothing to undo. */
	undo(model: TModel): TModel {
		return this.guarded(() => {
			const command = this.undoStack.at(-1);
			if (!command) {
				return model;
			}
			const result = command.undo(model);
			this.undoStack.pop();
			this.redoStack.push(command);
			this.sealed = true;
			this.publish();
			return result;
		});
	}

	/** Re-applies the most recently undone command; returns `model` unchanged when there is nothing to redo. */
	redo(model: TModel): TModel {
		return this.guarded(() => {
			const command = this.redoStack.at(-1);
			if (!command) {
				return model;
			}
			const result = command.execute(model);
			this.redoStack.pop();
			this.undoStack.push(command);
			this.sealed = true;
			this.publish();
			return result;
		});
	}

	/** Ends the current edit session: the next command starts a new undo step. */
	seal(): void {
		this.sealed = true;
	}

	/** Forgets all undo and redo steps. */
	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.sealed = true;
		this.publish();
	}

	private record(command: Command<TModel>): void {
		const previous = this.undoStack.at(-1);
		const merged = !this.sealed && previous ? previous.mergeWith?.(command) : undefined;
		if (merged) {
			this.undoStack[this.undoStack.length - 1] = merged;
		} else {
			this.undoStack.push(command);
			if (this.undoStack.length > this.maxDepth) {
				this.undoStack.splice(0, this.undoStack.length - this.maxDepth);
			}
		}
		this.redoStack = [];
		this.sealed = false;
		this.publish();
	}

	private guarded<T>(operation: () => T): T {
		if (this.running) {
			throw new Error("CommandHistory does not allow re-entrant calls while a command is running");
		}
		this.running = true;
		try {
			return operation();
		} finally {
			this.running = false;
		}
	}

	private publish(): void {
		this.statusStore.set(this.currentStatus());
	}
}
