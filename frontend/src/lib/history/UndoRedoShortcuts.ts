export interface UndoRedoActions {
	undo(): void;
	redo(): void;
	/** While this returns true (e.g. during a drag), shortcuts are ignored. */
	isBlocked?(): boolean;
}

const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/**
 * Maps keyboard shortcuts to undo/redo:
 * Ctrl/Cmd+Z → undo, Ctrl/Cmd+Shift+Z → redo, Ctrl+Y → redo (not Cmd+Y).
 * Ignored in text-entry fields (they have their own undo), during IME
 * composition, with Alt held, and while `isBlocked()` is true.
 */
export class UndoRedoShortcuts {
	constructor(private readonly actions: UndoRedoActions) {}

	/** Handles a keydown event; returns true (and prevents the default) when it triggered undo or redo. */
	handle(event: KeyboardEvent): boolean {
		const action = this.actionFor(event);
		if (!action || this.isIgnored(event)) {
			return false;
		}
		event.preventDefault();
		if (action === "undo") {
			this.actions.undo();
		} else {
			this.actions.redo();
		}
		return true;
	}

	private actionFor(event: KeyboardEvent): "undo" | "redo" | undefined {
		if (event.altKey) {
			return undefined;
		}
		const key = event.key.toLowerCase();
		if (key === "z" && (event.ctrlKey || event.metaKey)) {
			return event.shiftKey ? "redo" : "undo";
		}
		if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
			return "redo";
		}
		return undefined;
	}

	private isIgnored(event: KeyboardEvent): boolean {
		return event.isComposing || UndoRedoShortcuts.isTextEntry(event.target) || (this.actions.isBlocked?.() ?? false);
	}

	private static isTextEntry(target: EventTarget | null): boolean {
		return target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null;
	}
}
