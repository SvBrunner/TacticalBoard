/**
 * One reversible change to an immutable model. `execute` and `undo` return
 * the changed model and never mutate their argument, so a command that
 * throws leaves the model untouched.
 */
export interface Command<TModel> {
	/** Short human-readable description, e.g. "Move Player". */
	readonly label: string;

	execute(model: TModel): TModel;

	/** Reverts the effect of `execute`; called with the model `execute` produced. */
	undo(model: TModel): TModel;

	/** True when executing against `model` would change nothing; such commands are not recorded. */
	isNoOp?(model: TModel): boolean;

	/**
	 * Combines this command with the command executed directly after it into
	 * a single undo step, or returns `undefined` when they don't merge.
	 */
	mergeWith?(next: Command<TModel>): Command<TModel> | undefined;
}
