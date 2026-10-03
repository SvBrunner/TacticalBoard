import type { Command } from "./Command";

/** Test double: appends/removes a value on an immutable list of numbers. */
export class AppendCommand implements Command<readonly number[]> {
	constructor(
		readonly value: number,
		readonly label = `Append ${value}`,
	) {}

	execute(model: readonly number[]): readonly number[] {
		return [...model, this.value];
	}

	undo(model: readonly number[]): readonly number[] {
		return model.slice(0, -1);
	}
}
