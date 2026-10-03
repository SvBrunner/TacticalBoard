/** What the UI needs to know about one undo/redo history. */
export interface HistoryStatus {
	readonly canUndo: boolean;
	readonly canRedo: boolean;
	/** Label of the command `undo` would revert. */
	readonly undoLabel: string | undefined;
	/** Label of the command `redo` would re-apply. */
	readonly redoLabel: string | undefined;
}

export const EMPTY_HISTORY_STATUS: HistoryStatus = {
	canUndo: false,
	canRedo: false,
	undoLabel: undefined,
	redoLabel: undefined,
};

export function sameHistoryStatus(a: HistoryStatus, b: HistoryStatus): boolean {
	return a.canUndo === b.canUndo && a.canRedo === b.canRedo && a.undoLabel === b.undoLabel && a.redoLabel === b.redoLabel;
}
