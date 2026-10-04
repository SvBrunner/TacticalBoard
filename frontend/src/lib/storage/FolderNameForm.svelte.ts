import { NameForm } from "$lib/forms/NameForm.svelte";
import { FolderApi } from "./FolderApi";

/**
 * State of the "New folder" / "Rename folder" form, with the same rules as
 * the backend (arc42 ch. 8.15): trimmed, not empty, at most
 * `FolderApi.MAX_NAME_LENGTH` characters, no control characters. Whether the
 * name is free in the area only the server knows.
 */
export class FolderNameForm extends NameForm {
	protected problemOf(trimmed: string): string | null {
		if (trimmed.length === 0) {
			return "Enter a folder name.";
		}
		if (trimmed.length > FolderApi.MAX_NAME_LENGTH) {
			return `Use at most ${FolderApi.MAX_NAME_LENGTH} characters.`;
		}
		// eslint-disable-next-line no-control-regex
		if (/[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) {
			return "Don't use line breaks or other control characters.";
		}
		return null;
	}
}
