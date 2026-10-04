import type { UserReference } from "./SituationApi";

/** Shown instead of the name of a deleted user (arc42 ch. 1). */
export const DELETED_USER = "Deleted user";

/** How saved situations' metadata is shown. */
export class SavedSituationFormat {
	private static readonly dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

	/** The user's display name, or "Deleted user". */
	static userName(user: UserReference): string {
		return user.displayName ?? DELETED_USER;
	}

	/** A timestamp in the browser's locale, e.g. "4 Oct 2026, 10:30". */
	static dateTime(iso: string): string {
		const date = new Date(iso);
		return Number.isNaN(date.getTime()) ? iso : SavedSituationFormat.dateTimeFormat.format(date);
	}

	/** "Full field" / "Half field". */
	static fieldType(fieldType: string): string {
		if (fieldType === "full") return "Full field";
		if (fieldType === "half") return "Half field";
		return fieldType;
	}
}
