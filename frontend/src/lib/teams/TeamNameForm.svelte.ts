import { NameForm } from "$lib/forms/NameForm.svelte";
import type { Translatable } from "$lib/i18n/Messages";
import { TeamApi } from "./TeamApi";

/**
 * State of a team's name field ("Create team", "Rename team"), with the same
 * rules as the backend (arc42 ch. 8.17): trimmed, not empty, at most
 * `TeamApi.MAX_NAME_LENGTH` characters, no control characters. Whether the
 * name is free only the server knows.
 */
export class TeamNameForm extends NameForm {
	protected problemOf(trimmed: string): Translatable | null {
		if (trimmed.length === 0) {
			return (m) => m.teams.enterName;
		}
		if (trimmed.length > TeamApi.MAX_NAME_LENGTH) {
			return (m) => m.errors.maxLength(TeamApi.MAX_NAME_LENGTH);
		}
		// eslint-disable-next-line no-control-regex
		if (/[\u0000-\u001f\u007f-\u009f]/.test(trimmed)) {
			return (m) => m.teams.noControlCharacters;
		}
		return null;
	}
}
