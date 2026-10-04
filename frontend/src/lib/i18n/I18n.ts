import { derived, get, writable, type Readable } from "svelte/store";
import type { KeyValueStorage } from "$lib/playback/KeyValueStorage";
import type { LanguageOption, LocaleRegistry } from "./LocaleRegistry";
import type { Messages } from "./Messages";

/**
 * The UI language (arc42 ch. 8.18): which translation is shown, as stores
 * (`language`, `messages`) the components render from.
 *
 * The language starts as the one remembered in the browser (an earlier
 * choice), otherwise the browser's preferred language if the app has it,
 * otherwise English. Choosing a language (`select`) remembers it in the
 * browser (`localStorage`, key `tacticalboard.language`; failures are
 * ignored). Every change is passed to `onChange` (the app sets `<html lang>`).
 */
export class I18n {
	static readonly STORAGE_KEY = "tacticalboard.language";

	private readonly code = writable<string>();

	/** The current language code, e.g. `de`. */
	readonly language: Readable<string>;
	/** The current language's catalog. */
	readonly messages: Readable<Messages>;

	constructor(
		private readonly registry: LocaleRegistry,
		private readonly storage: KeyValueStorage,
		private readonly onChange: (code: string) => void = () => {},
	) {
		this.code.set(registry.fallback.code);
		this.language = { subscribe: this.code.subscribe };
		this.messages = derived(this.code, (code) => registry.get(code).messages);
	}

	/**
	 * Picks the start language: the remembered choice, else the first of the
	 * browser's `preferences` the app supports, else English. Returns it.
	 */
	start(preferences: readonly string[]): string {
		const remembered = this.registry.resolve(this.storage.read(I18n.STORAGE_KEY));
		const code = remembered ?? this.registry.match(preferences);
		this.show(code);
		return code;
	}

	/**
	 * Switches to `code` and remembers it in the browser. Returns false (and
	 * changes nothing) when the app has no translation for it.
	 */
	select(code: string): boolean {
		const supported = this.registry.resolve(code);
		if (supported === null) {
			return false;
		}
		this.storage.write(I18n.STORAGE_KEY, supported);
		this.show(supported);
		return true;
	}

	/** Whether the app has a translation for `code` (or its primary subtag). */
	supports(code: string | null | undefined): boolean {
		return this.registry.resolve(code) !== null;
	}

	/** The current language code. */
	current(): string {
		return get(this.code);
	}

	/** The current language's catalog. */
	currentMessages(): Messages {
		return this.registry.get(this.current()).messages;
	}

	/** The languages the switcher offers. */
	languages(): LanguageOption[] {
		return this.registry.languages();
	}

	/** Back to English without remembering anything (for tests). */
	reset(): void {
		this.show(this.registry.fallback.code);
	}

	private show(code: string): void {
		this.code.set(code);
		this.onChange(code);
	}
}
