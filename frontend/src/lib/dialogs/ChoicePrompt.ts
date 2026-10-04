import { writable, type Readable } from "svelte/store";

/**
 * Promise-based bridge between code that needs the user's choice and a
 * dialog component: `request` shows the question (via `pending`) and
 * resolves once the dialog calls `answer`. At most one question is pending;
 * a new request answers the previous one with the `dismissed` answer (the
 * safe choice, e.g. "no" or "cancel").
 */
export class ChoicePrompt<TRequest, TAnswer> {
	private readonly store = writable<TRequest | null>(null);
	private resolveCurrent: ((answer: TAnswer) => void) | null = null;

	/** The question currently asked, or `null` when none is. */
	readonly pending: Readable<TRequest | null> = { subscribe: this.store.subscribe };

	constructor(private readonly dismissed: TAnswer) {}

	request(request: TRequest): Promise<TAnswer> {
		this.answer(this.dismissed);
		this.store.set(request);
		return new Promise<TAnswer>((resolve) => {
			this.resolveCurrent = resolve;
		});
	}

	/** Answers the pending question (no-op when there is none). */
	answer(answer: TAnswer): void {
		const resolve = this.resolveCurrent;
		if (!resolve) {
			return;
		}
		this.resolveCurrent = null;
		this.store.set(null);
		resolve(answer);
	}

	/** Answers the pending question with the safe choice (e.g. Escape). */
	dismiss(): void {
		this.answer(this.dismissed);
	}
}
