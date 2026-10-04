import { englishMessages, localeRegistry } from "$lib/i18n";
import type { Messages, Translatable } from "$lib/i18n/Messages";

/** The English catalog (tests run in English). */
export const en: Messages = englishMessages;

/** The German catalog. */
export const de: Messages = localeRegistry.get("de").messages;

/**
 * A value with every `Translatable` in it (any function-valued property of a
 * plain object or array) turned into its English text, so results like
 * `{ ok: false, message: (m) => … }` can be compared with plain objects.
 */
export function inEnglishDeep<T>(value: T): unknown {
	return translateDeep(value, en);
}

/** Like `inEnglishDeep`, in any catalog. */
export function translateDeep<T>(value: T, messages: Messages): unknown {
	if (typeof value === "function") {
		return (value as Translatable)(messages);
	}
	if (Array.isArray(value)) {
		return value.map((item) => translateDeep(item, messages));
	}
	if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, translateDeep(item, messages)]));
	}
	return value;
}
