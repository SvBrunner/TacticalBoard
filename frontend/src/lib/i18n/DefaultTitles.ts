import type { LocaleDefinition } from "./Messages";

/**
 * The default title of a new situation in every UI language (arc42 ch.
 * 8.18): a new situation created with a blank title stores the default
 * title of the language the UI had then, e.g. "Untitled Situation" or
 * "Unbenannte Situation". When it is saved for the first time, the server
 * numbers such a title within the area instead of refusing it as taken, so
 * the frontend tells it which titles are default titles.
 */
export class DefaultTitles {
	private readonly normalized: ReadonlySet<string>;

	constructor(locales: readonly LocaleDefinition[]) {
		this.normalized = new Set(locales.map((locale) => DefaultTitles.normalize(locale.messages.situation.defaultTitle)));
	}

	/** Whether `title` is blank or a default title of any language (ignoring case and surrounding spaces). */
	matches(title: string): boolean {
		const normalized = DefaultTitles.normalize(title);
		return normalized === "" || this.normalized.has(normalized);
	}

	/** Compared like the server compares titles: trimmed, NFC, upper case. */
	private static normalize(title: string): string {
		return title.trim().normalize("NFC").toUpperCase();
	}
}
