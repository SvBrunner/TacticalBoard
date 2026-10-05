import { get, writable, type Readable } from "svelte/store";
import { ApiError } from "$lib/api/ApiClient";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import { TeamApi, type Team } from "./TeamApi";
import { TeamMessages, type TeamChange } from "./TeamMessages";

/** The state of the team shown on its page. */
export type CurrentTeamState =
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly team: Team }
	/** No team has this code (any more). */
	| { readonly status: "missing" }
	| { readonly status: "failed"; readonly message: Translatable };

export interface CurrentTeamDependencies {
	readonly api: {
		get(code: string): Promise<Team>;
		rename(code: string, name: string): Promise<Team>;
		setLogo(code: string, logo: File): Promise<Team>;
		removeLogo(code: string): Promise<void>;
	};
	readonly code: string;
	readonly onSessionEnded?: () => void;
	readonly log?: {
		notify(message: string, level?: "info" | "warn" | "error"): void;
	};
}

/**
 * The team a team page shows (arc42 ch. 8.17): loads it by its code, and —
 * for its Admins — renames it and sets, replaces or removes its logo.
 */
export class CurrentTeam {
	private readonly store = writable<CurrentTeamState>({ status: "loading" });

	readonly state: Readable<CurrentTeamState> = {
		subscribe: this.store.subscribe,
	};

	constructor(private readonly deps: CurrentTeamDependencies) {}

	current(): CurrentTeamState {
		return get(this.store);
	}

	/** The loaded team, or `null`. */
	team(): Team | null {
		const state = this.current();
		return state.status === "loaded" ? state.team : null;
	}

	/** Whether the current user may change the team's name and logo (its Admins). */
	canChangeDetails(): boolean {
		return this.team()?.role === "admin";
	}

	/** Loads the team. Never throws. */
	async load(): Promise<void> {
		this.store.set({ status: "loading" });
		try {
			this.store.set({
				status: "loaded",
				team: await this.deps.api.get(this.deps.code),
			});
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) {
				this.store.set({ status: "missing" });
				return;
			}
			this.store.set({
				status: "failed",
				message: this.failure(
					error,
					TeamMessages.general(error, (m) => m.teamPage.loadFailed),
				),
			});
		}
	}

	/** Renames the team. Never throws. */
	async rename(name: string): Promise<TeamChange<Team>> {
		try {
			const team = await this.deps.api.rename(this.deps.code, name);
			this.store.set({ status: "loaded", team });
			this.log(`Renamed team ${team.code} to "${team.name}"`);
			return { ok: true, team };
		} catch (error) {
			this.markMissingOn(error);
			return {
				ok: false,
				message: this.failure(
					error,
					TeamMessages.forChange(error, name, (m) => m.teams.renameFailed),
				),
			};
		}
	}

	/** Sets or replaces the logo. Never throws. */
	async setLogo(logo: File): Promise<TeamChange<Team>> {
		try {
			const team = await this.deps.api.setLogo(this.deps.code, logo);
			this.store.set({ status: "loaded", team });
			this.log(`Set the logo of team ${team.code}`);
			return { ok: true, team };
		} catch (error) {
			this.markMissingOn(error);
			return {
				ok: false,
				message: this.failure(
					error,
					TeamMessages.forLogo(error, (m) => m.teamPage.logoFailed),
				),
			};
		}
	}

	/** Removes the logo. Never throws. */
	async removeLogo(): Promise<TeamChange<Team>> {
		const team = this.team();
		try {
			await this.deps.api.removeLogo(this.deps.code);
			const updated = team ? { ...team, logoUrl: null } : await this.deps.api.get(this.deps.code);
			this.store.set({ status: "loaded", team: updated });
			this.log(`Removed the logo of team ${this.deps.code}`);
			return { ok: true, team: updated };
		} catch (error) {
			this.markMissingOn(error);
			return {
				ok: false,
				message: this.failure(
					error,
					TeamMessages.general(error, (m) => m.teamPage.removeLogoFailed),
				),
			};
		}
	}

	private markMissingOn(error: unknown): void {
		if (error instanceof ApiError && error.type === TeamApi.NOT_FOUND) {
			this.store.set({ status: "missing" });
		}
	}

	private failure(error: unknown, message: Translatable): Translatable {
		if (TeamMessages.isSessionEnded(error)) {
			this.deps.onSessionEnded?.();
		}
		this.log(inEnglish(message), "error");
		return message;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
