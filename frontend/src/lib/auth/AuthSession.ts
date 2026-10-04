import { get, writable, type Readable } from "svelte/store";
import { ApiClient, ApiError, type AntiforgeryToken } from "$lib/api/ApiClient";
import type { Translatable } from "$lib/i18n/Messages";
import { ProblemText } from "$lib/i18n/ProblemText";

/** The logged-in user, as `GET /api/me` returns it. */
export interface CurrentUser {
	readonly id: string;
	readonly displayName: string;
	readonly isSystemAdministrator: boolean;
	/** The UI language stored in the account (arc42 ch. 8.18), or `null` if the user never chose one. */
	readonly preferredLanguage: string | null;
}

/**
 * - `unknown`: not asked yet (or asking).
 * - `anonymous`: the backend answered, nobody is logged in.
 * - `unavailable`: no backend (e.g. the dev server alone); local mode only.
 * - `authenticated`: logged in as `user`.
 */
export type SessionState =
	| { readonly status: "unknown" }
	| { readonly status: "anonymous" }
	| { readonly status: "unavailable" }
	| { readonly status: "authenticated"; readonly user: CurrentUser };

/** The result of changing the display name: the updated user, or a message to show. */
export type DisplayNameChange = { readonly ok: true; readonly user: CurrentUser } | { readonly ok: false; readonly message: Translatable };

/**
 * Why the last login gave no session, as the backend reports it on the start
 * page (`?login=failed` / `?login=blocked`, arc42 ch. 8.13).
 */
export type LoginNotice = "failed" | "blocked";

/** A hidden form field (the antiforgery token for the logout form). */
export interface FormField {
	readonly name: string;
	readonly value: string;
}

/**
 * The login session as the frontend sees it (BFF, arc42 ch. 8.13): who is
 * logged in (`state`), where to log in and out, and the user's own account
 * changes. The frontend never sees tokens; it only knows `/auth/login`,
 * `/auth/logout` and `/api/me` (ADR-006). Every failure to reach the backend
 * ends in the quiet `unavailable` state, so local mode keeps working.
 */
export class AuthSession {
	static readonly ME_PATH = "/api/me";
	static readonly DISPLAY_NAME_PATH = "/api/me/display-name";
	static readonly LANGUAGE_PATH = "/api/me/language";
	static readonly LOGIN_PATH = "/auth/login";
	static readonly LOGOUT_PATH = "/auth/logout";
	/** The query parameter the backend adds to the start page when a login failed. */
	static readonly LOGIN_FAILED_PARAMETER = "login";

	private readonly store = writable<SessionState>({ status: "unknown" });

	readonly state: Readable<SessionState> = { subscribe: this.store.subscribe };

	constructor(private readonly api: ApiClient) {}

	/** The current state, without subscribing. */
	current(): SessionState {
		return get(this.store);
	}

	/** Asks the backend who is logged in. Never throws. */
	async refresh(): Promise<SessionState> {
		let next: SessionState;
		try {
			const user = await this.api.get<CurrentUser>(AuthSession.ME_PATH);
			next = { status: "authenticated", user };
		} catch (error) {
			next = error instanceof ApiError && error.status === 401 ? { status: "anonymous" } : { status: "unavailable" };
		}
		this.store.set(next);
		return next;
	}

	/** The URL that starts the login and comes back to `returnTo` (a local path; anything else returns to `/`). */
	loginUrl(returnTo = "/"): string {
		const target = AuthSession.isLocalPath(returnTo) ? returnTo : "/";
		return `${AuthSession.LOGIN_PATH}?returnUrl=${encodeURIComponent(target)}`;
	}

	/** Why the last login failed, if the page was opened after one (`?login=failed` or `?login=blocked`). */
	static loginNotice(search: string): LoginNotice | null {
		const value = new URLSearchParams(search).get(AuthSession.LOGIN_FAILED_PARAMETER);
		return value === "failed" || value === "blocked" ? value : null;
	}

	/** The antiforgery field the logout form (a plain POST to `/auth/logout`) has to carry. */
	async logoutField(): Promise<FormField> {
		const token: AntiforgeryToken = await this.api.antiforgeryToken();
		return { name: token.formFieldName, value: token.token };
	}

	/** Changes the logged-in user's display name; on success the state carries the new name. */
	async changeDisplayName(displayName: string): Promise<DisplayNameChange> {
		try {
			const user = await this.api.send<CurrentUser>("PUT", AuthSession.DISPLAY_NAME_PATH, { displayName });
			this.store.set({ status: "authenticated", user });
			return { ok: true, user };
		} catch (error) {
			return { ok: false, message: this.messageFor(error) };
		}
	}

	/**
	 * Stores `language` as the logged-in user's UI language (arc42 ch. 8.18);
	 * on success the state carries it. Resolves with whether it was stored.
	 * Never throws.
	 */
	async changeLanguage(language: string): Promise<boolean> {
		try {
			const user = await this.api.send<CurrentUser>("PUT", AuthSession.LANGUAGE_PATH, { language });
			this.store.set({ status: "authenticated", user });
			return true;
		} catch (error) {
			if (ProblemText.isSessionEnded(error)) {
				this.store.set({ status: "anonymous" });
			}
			return false;
		}
	}

	private messageFor(error: unknown): Translatable {
		if (ProblemText.isSessionEnded(error)) {
			this.store.set({ status: "anonymous" });
			return ProblemText.SESSION_ENDED;
		}
		if (error instanceof ApiError) {
			const problem = ProblemText.fieldError(error, "displayName");
			if (problem) {
				return (m) => m.fieldErrors.displayName(problem(m));
			}
		}
		return ProblemText.describe(error, (m) => m.account.displayNameNotSaved);
	}

	/** A path on this origin: one leading `/`, not `//` or `/\`. */
	private static isLocalPath(path: string): boolean {
		return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
	}
}

/** The app's API client and login session. */
export const apiClient = new ApiClient();
export const authSession = new AuthSession(apiClient);
