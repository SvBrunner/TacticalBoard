import type { Messages } from "$lib/i18n/Messages";
import type { UserReference } from "./SituationApi";

/** How saved situations' metadata is shown, in the UI language (arc42 ch. 8.18). */
export class SavedSituationFormat {
	private static readonly dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

	/** The user's display name, or "Deleted user" (arc42 ch. 1). */
	static userName(user: UserReference, messages: Messages): string {
		return user.displayName ?? messages.situation.deletedUser;
	}

	/** A timestamp in the conventions of the UI language, e.g. "Oct 4, 2026, 10:30 AM" or "04.10.2026, 10:30". */
	static dateTime(iso: string, language: string): string {
		const date = new Date(iso);
		return Number.isNaN(date.getTime()) ? iso : SavedSituationFormat.formatFor(language).format(date);
	}

	/** "Full field" / "Half field"; an unknown value as it is. */
	static fieldType(fieldType: string, messages: Messages): string {
		if (fieldType === "full" || fieldType === "half") {
			return messages.situation.fieldTypes[fieldType];
		}
		return fieldType;
	}

	private static formatFor(language: string): Intl.DateTimeFormat {
		let format = SavedSituationFormat.dateTimeFormats.get(language);
		if (!format) {
			format = new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" });
			SavedSituationFormat.dateTimeFormats.set(language, format);
		}
		return format;
	}
}
