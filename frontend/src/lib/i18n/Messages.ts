/**
 * The shape of a message catalog: every system text of the UI (arc42 ch.
 * 8.18). The English catalog (`locales/en.ts`) defines it; every other
 * catalog must have exactly the same keys (the type checker enforces it).
 * Texts with values are functions, so each language can order and inflect
 * them as it needs.
 */
export type Messages = typeof import("./locales/en").messages;

/** One language the UI is available in: a translation file in `locales/`. */
export interface LocaleDefinition {
	/** The language code (BCP 47 primary language subtag, lower case), e.g. `de`. */
	readonly code: string;
	/** The language's own name, shown in the language switcher, e.g. "Deutsch". */
	readonly name: string;
	readonly messages: Messages;
}

/**
 * A text for the user that is translated when it is shown, not when it is
 * created: classes return it (e.g. an error message), components render it
 * with the current catalog, so a language switch also changes texts already
 * on screen.
 */
export type Translatable = (messages: Messages) => string;
