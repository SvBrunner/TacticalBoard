import { NameForm } from "$lib/forms/NameForm.svelte";
import type { Translatable } from "$lib/i18n/Messages";
import { FolderApi } from "./FolderApi";

/**
 * State of the "New folder" / "Rename folder" form, with the same rules as
 * the backend (arc42 ch. 8.15): trimmed, not empty, at most
 * `FolderApi.MAX_NAME_LENGTH` characters, no control characters. Whether the
 * name is free in the area only the server knows.
 */
export class FolderNameForm extends NameForm {
	protected problemOf(trimmed: string): Translatable | null {
		if (trimmed.length === 0) {
			return (m) => m.folders.enterName;
		}
		if (trimmed.length > FolderApi.MAX_NAME_LENGTH) {
			return (m) => m.errors.maxLength(FolderApi.MAX_NAME_LENGTH);
		}
		// eslint-disable-next-line no-control-regex
		if (/[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) {
			return (m) => m.folders.noControlCharacters;
		}
		return null;
	}
}
