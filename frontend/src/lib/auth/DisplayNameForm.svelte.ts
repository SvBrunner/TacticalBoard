import { NameForm } from "$lib/forms/NameForm.svelte";

/**
 * State of the "Change display name" form, with the same rules as the
 * backend: trimmed, not empty, at most `MAX_LENGTH` characters.
 */
export class DisplayNameForm extends NameForm {
	/** Same limit as the backend (counted in UTF-16 code units, like `maxlength`). */
	static readonly MAX_LENGTH = 100;

	protected problemOf(trimmed: string): string | null {
		if (trimmed.length === 0) {
			return "Enter a display name.";
		}
		if (trimmed.length > DisplayNameForm.MAX_LENGTH) {
			return `Use at most ${DisplayNameForm.MAX_LENGTH} characters.`;
		}
		return null;
	}
}
