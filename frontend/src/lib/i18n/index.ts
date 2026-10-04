import { authSession } from "$lib/auth/AuthSession";
import { notifications } from "$lib/debug/Notifications";
import { WebKeyValueStorage } from "$lib/playback/KeyValueStorage";
import { AccountLanguage } from "./AccountLanguage";
import { DefaultTitles } from "./DefaultTitles";
import { I18n } from "./I18n";
import { LocaleRegistry } from "./LocaleRegistry";
import type { Messages, Translatable } from "./Messages";

export type { Messages, Translatable } from "./Messages";

/** Every bundled translation (`locales/*.ts`). */
export const localeRegistry = LocaleRegistry.bundled();

/** The app's UI language; `<html lang>` follows it. */
export const i18n = new I18n(localeRegistry, new WebKeyValueStorage(), (code) => {
	if (typeof document !== "undefined") {
		document.documentElement.lang = code;
	}
});

/** The current catalog, for components: `{$t.common.cancel}`. */
export const t = i18n.messages;

/** The current language code, e.g. for formatting dates. */
export const language = i18n.language;

/** The English catalog: debug log messages stay English whatever the UI language. */
export const englishMessages: Messages = localeRegistry.fallback.messages;

/** A `Translatable` in English, for the debug log. */
export function inEnglish(text: Translatable): string {
	return text(englishMessages);
}

/** Keeps the UI language and the logged-in user's account in step. */
export const accountLanguage = new AccountLanguage({ i18n, session: authSession, log: notifications });

/** The default titles of all languages, for the server's numbering of new situations. */
export const defaultTitles = new DefaultTitles(localeRegistry.all());
