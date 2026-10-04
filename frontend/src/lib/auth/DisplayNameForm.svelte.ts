/**
 * State of the "Change display name" form: the input (reactive, bindable),
 * the same rules as the backend (trimmed, not empty, at most
 * `MAX_LENGTH` characters), and whether to show the problem yet (only after
 * a submit attempt, not while typing the first characters).
 */
export class DisplayNameForm {
	/** Same limit as the backend (counted in UTF-16 code units, like `maxlength`). */
	static readonly MAX_LENGTH = 100;

	value = $state("");
	/** An error from the server, shown until the input changes. */
	serverError = $state<string | null>(null);
	saving = $state(false);
	private attempted = $state(false);

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
		if (this.trimmed.length === 0) {
			return "Enter a display name.";
		}
		if (this.trimmed.length > DisplayNameForm.MAX_LENGTH) {
			return `Use at most ${DisplayNameForm.MAX_LENGTH} characters.`;
		}
		return null;
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
