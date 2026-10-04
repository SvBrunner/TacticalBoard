import { isInsideModalDialog } from "$lib/actions/modalDialog";

export interface SaveShortcutActions {
	save(): void;
	/** Whether saving is possible at all (logged in); otherwise the browser keeps its own Ctrl+S. */
	canSave(): boolean;
}

/**
 * Ctrl+S / Cmd+S saves the situation on the server (arc42 ch. 8.15), also
 * from a text field (saving is not an edit of that field). While saving is
 * possible the browser's "Save page" is always prevented; inside a modal
 * dialog nothing is saved. Ignored during IME composition and with Alt or
 * Shift held. Without login the browser's own shortcut stays.
 */
export class SaveShortcut {
	constructor(private readonly actions: SaveShortcutActions) {}

	/** Handles a keydown event; returns true when it was the save shortcut and was taken over. */
	handle(event: KeyboardEvent): boolean {
		if (!SaveShortcut.isSaveKey(event) || !this.actions.canSave()) {
			return false;
		}
		event.preventDefault();
		if (!isInsideModalDialog(event.target)) {
			this.actions.save();
		}
		return true;
	}

	private static isSaveKey(event: KeyboardEvent): boolean {
		return (
			(event.ctrlKey || event.metaKey) &&
			!event.altKey &&
			!event.shiftKey &&
			!event.isComposing &&
			event.key.toLowerCase() === "s"
		);
	}
}
