import type { LocaleDefinition } from "./Messages";

/** A language as the switcher offers it. */
export interface LanguageOption {
	readonly code: string;
	readonly name: string;
}

/**
 * The languages the UI is available in, one translation file each, and how
 * a browser's language preferences map to them. `en` is the fallback.
 */
export class LocaleRegistry {
	static readonly FALLBACK = "en";

	private readonly byCode: ReadonlyMap<string, LocaleDefinition>;

	constructor(locales: readonly LocaleDefinition[]) {
		const byCode = new Map<string, LocaleDefinition>();
		for (const locale of locales) {
			const code = locale.code.toLowerCase();
			if (byCode.has(code)) {
				throw new Error(`Duplicate translation for language "${code}"`);
			}
			byCode.set(code, locale);
		}
		if (!byCode.has(LocaleRegistry.FALLBACK)) {
			throw new Error(`The fallback language "${LocaleRegistry.FALLBACK}" has no translation`);
		}
		this.byCode = byCode;
	}

	/**
	 * Every translation file in `locales/` (each `export default` a
	 * `LocaleDefinition`): adding a language needs nothing but a new file.
	 */
	static bundled(): LocaleRegistry {
		const modules = import.meta.glob<{ default: LocaleDefinition }>("./locales/*.ts", { eager: true });
		return new LocaleRegistry(Object.values(modules).map((module) => module.default));
	}

	/** The fallback language's definition (English). */
	get fallback(): LocaleDefinition {
		return this.byCode.get(LocaleRegistry.FALLBACK)!;
	}

	/** The languages, by name (for the switcher). */
	languages(): LanguageOption[] {
		return [...this.byCode.values()]
			.map(({ code, name }) => ({ code, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	/** Every language's definition. */
	all(): LocaleDefinition[] {
		return [...this.byCode.values()];
	}

	/** Whether there is a translation for exactly this code (ignoring case). */
	has(code: string): boolean {
		return this.byCode.has(code.toLowerCase());
	}

	/** The definition of `code`, or the fallback when there is no translation for it. */
	get(code: string): LocaleDefinition {
		return this.byCode.get(code.toLowerCase()) ?? this.fallback;
	}

	/**
	 * The supported language for a language tag such as `de-CH` (its primary
	 * subtag, ignoring case), or `null`.
	 */
	resolve(tag: string | null | undefined): string | null {
		const primary = tag?.trim().split(/[-_]/)[0]?.toLowerCase();
		return primary && this.byCode.has(primary) ? primary : null;
	}

	/**
	 * The language for the browser's preferences (`navigator.languages`, most
	 * preferred first): the first one the app supports, otherwise the fallback.
	 */
	match(preferences: readonly string[]): string {
		for (const tag of preferences) {
			const code = this.resolve(tag);
			if (code) {
				return code;
			}
		}
		return LocaleRegistry.FALLBACK;
	}
}
