import type { Command } from "./Command";

/** Several commands recorded as one undo step. Undo runs in reverse order. */
export class CompositeCommand<TModel> implements Command<TModel> {
	readonly commands: readonly Command<TModel>[];

	constructor(
		readonly label: string,
		commands: readonly Command<TModel>[],
	) {
		this.commands = [...commands];
	}

	execute(model: TModel): TModel {
		return this.commands.reduce((current, command) => command.execute(current), model);
	}

	undo(model: TModel): TModel {
		return this.commands.reduceRight((current, command) => command.undo(current), model);
	}

	/** A composite is a no-op when it is empty or every part reports a no-op against `model`. */
	isNoOp(model: TModel): boolean {
		return this.commands.every((command) => command.isNoOp?.(model) ?? false);
	}
}
