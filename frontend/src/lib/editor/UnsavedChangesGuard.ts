/** The part of `window` the guard needs. */
export interface UnloadEventTarget {
	addEventListener(type: "beforeunload", listener: (event: BeforeUnloadEvent) => void): void;
	removeEventListener(type: "beforeunload", listener: (event: BeforeUnloadEvent) => void): void;
}

/**
 * Makes the browser warn before the page is left or reloaded while there
 * are unsaved changes (the browser shows its own generic message). Does
 * nothing while there are none. In-app navigation is not affected.
 */
export class UnsavedChangesGuard {
	private readonly listener = (event: BeforeUnloadEvent) => this.handleBeforeUnload(event);

	constructor(private readonly hasUnsavedChanges: () => boolean) {}

	/** Starts guarding `target`; returns a function that stops it again. */
	attach(target: UnloadEventTarget): () => void {
		target.addEventListener("beforeunload", this.listener);
		return () => target.removeEventListener("beforeunload", this.listener);
	}

	handleBeforeUnload(event: BeforeUnloadEvent): void {
		if (!this.hasUnsavedChanges()) {
			return;
		}
		event.preventDefault();
		// Legacy browsers only show the warning when returnValue is set.
		event.returnValue = true;
	}
}
