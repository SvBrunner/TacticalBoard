import { NameForm } from "$lib/forms/NameForm.svelte";
import type { Translatable } from "$lib/i18n/Messages";

/**
 * State of the "Change display name" form, with the same rules as the
 * backend: trimmed, not empty, at most `MAX_LENGTH` characters.
 */
export class DisplayNameForm extends NameForm {
	/** Same limit as the backend (counted in UTF-16 code units, like `maxlength`). */
	static readonly MAX_LENGTH = 100;

	protected problemOf(trimmed: string): Translatable | null {
		if (trimmed.length === 0) {
			return (m) => m.account.enterDisplayName;
		}
		if (trimmed.length > DisplayNameForm.MAX_LENGTH) {
			return (m) => m.errors.maxLength(DisplayNameForm.MAX_LENGTH);
		}
		return null;
	}
}
