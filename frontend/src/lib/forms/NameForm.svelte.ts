/**
 * State of a form with one name field (display name, folder name): the input
 * (reactive, bindable), the rules (`problemOf`, the same as the backend's),
 * and whether to show the problem yet (only after a submit attempt, not while
 * typing the first characters). A server error is shown until the input
 * changes.
 */
export abstract class NameForm {
	value = $state("");
	/** An error from the server, shown until the input changes. */
	serverError = $state<string | null>(null);
	saving = $state(false);
	private attempted = $state(false);

	/** What's wrong with the trimmed input, or `null`. */
	protected abstract problemOf(trimmed: string): string | null;

	/** Starts over with `current` as the value. */
	reset(current: string): void {
		this.value = current;
		this.serverError = null;
		this.saving = false;
		this.attempted = false;
	}

	/** The trimmed name. */
	get trimmed(): string {
		return this.value.trim();
	}

	/** What's wrong with the input, or `null`. */
	get problem(): string | null {
		return this.problemOf(this.trimmed);
	}

	get isValid(): boolean {
		return this.problem === null;
	}

	/** The message to show now: the server's, or the input problem after a submit attempt. */
	get message(): string | null {
		return this.serverError ?? (this.attempted ? this.problem : null);
	}

	/** Records a submit attempt; returns whether the input may be sent. */
	attemptSubmit(): boolean {
		this.attempted = true;
		this.serverError = null;
		return this.isValid;
	}

	/** The input changed: a server error no longer applies. */
	edited(): void {
		this.serverError = null;
	}
}
