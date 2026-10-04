import type { Readable } from "svelte/store";
import type { SessionState } from "$lib/auth/AuthSession";

/** The language parts of `I18n` this class uses. */
export interface LanguageSettings {
	current(): string;
	select(code: string): boolean;
	supports(code: string | null | undefined): boolean;
}

/** The session parts this class uses; implemented by `AuthSession`. */
export interface LanguageSession {
	readonly state: Readable<SessionState>;
	current(): SessionState;
	changeLanguage(language: string): Promise<boolean>;
}

export interface AccountLanguageDependencies {
	readonly i18n: LanguageSettings;
	readonly session: LanguageSession;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * Keeps the UI language and the logged-in user's account in step (arc42
 * ch. 8.18):
 * - when a user is logged in (on login, or when the app starts with a
 *   session), the language stored in the account wins — if the app has a
 *   translation for it; an account without a language keeps the browser's;
 * - choosing a language in the switcher applies it at once (and remembers it
 *   in the browser) and, when logged in, also stores it in the account.
 *   A failure to store it is not shown as an error; the language stays
 *   in this browser.
 */
export class AccountLanguage {
	/** The user the account's language was last applied for. */
	private appliedFor: string | null = null;

	constructor(private readonly deps: AccountLanguageDependencies) {}

	/** Starts following the session; returns the function that stops it. */
	attach(): () => void {
		return this.deps.session.state.subscribe((state) => this.sessionChanged(state));
	}

	/**
	 * The user chose `code` in the switcher. Resolves with whether it was
	 * applied (and, when logged in, also stored in the account).
	 */
	async choose(code: string): Promise<boolean> {
		if (!this.deps.i18n.select(code)) {
			return false;
		}
		const state = this.deps.session.current();
		if (state.status !== "authenticated" || state.user.preferredLanguage === this.deps.i18n.current()) {
			return true;
		}
		const stored = await this.deps.session.changeLanguage(this.deps.i18n.current());
		if (!stored) {
			this.deps.log?.notify(`The language ${code} couldn't be stored in the account`, "warn");
		}
		return stored;
	}

	private sessionChanged(state: SessionState): void {
		if (state.status !== "authenticated") {
			this.appliedFor = null;
			return;
		}
		if (this.appliedFor === state.user.id) {
			return;
		}
		this.appliedFor = state.user.id;
		const preferred = state.user.preferredLanguage;
		if (this.deps.i18n.supports(preferred) && preferred !== this.deps.i18n.current()) {
			this.deps.i18n.select(preferred!);
			this.deps.log?.notify(`Language from the account: ${preferred}`);
		}
	}
}
