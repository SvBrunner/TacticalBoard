import { writable, type Readable } from "svelte/store";

/** What a confirmation dialog asks. */
export interface ConfirmationRequest {
	readonly title: string;
	readonly message: string;
	readonly confirmLabel: string;
	readonly cancelLabel?: string;
}

/**
 * Promise-based bridge between code that needs a yes/no answer and a
 * confirmation dialog component: `request` shows the question (via
 * `pending`) and resolves once the dialog calls `answer`. At most one
 * question is pending; a new request answers the previous one with "no".
 */
export class ConfirmationPrompt {
	private readonly store = writable<ConfirmationRequest | null>(null);
	private resolveCurrent: ((confirmed: boolean) => void) | null = null;

	/** The question currently asked, or `null` when none is. */
	readonly pending: Readable<ConfirmationRequest | null> = { subscribe: this.store.subscribe };

	request(request: ConfirmationRequest): Promise<boolean> {
		this.answer(false);
		this.store.set(request);
		return new Promise<boolean>((resolve) => {
			this.resolveCurrent = resolve;
		});
	}

	/** Answers the pending question (no-op when there is none). */
	answer(confirmed: boolean): void {
		const resolve = this.resolveCurrent;
		if (!resolve) {
			return;
		}
		this.resolveCurrent = null;
		this.store.set(null);
		resolve(confirmed);
	}
}
