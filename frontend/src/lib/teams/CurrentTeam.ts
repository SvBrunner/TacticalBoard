import { get, writable, type Readable } from "svelte/store";
import { ApiError } from "$lib/api/ApiClient";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import { TeamApi, type Team } from "./TeamApi";
import { TeamMessages, type MembershipOutcome, type TeamChange } from "./TeamMessages";

/** The state of the team shown on its page. */
export type CurrentTeamState =
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly team: Team }
	/** No team has this code (any more). */
	| { readonly status: "missing" }
	| { readonly status: "failed"; readonly message: Translatable };

export interface CurrentTeamDependencies {
	readonly api: {
		get(team: string): Promise<Team>;
		rename(team: string, name: string): Promise<Team>;
		setLogo(team: string, logo: File): Promise<Team>;
		removeLogo(team: string): Promise<void>;
		requestToJoin(team: string): Promise<unknown>;
		leave(team: string): Promise<void>;
		delete(team: string): Promise<void>;
	};
	/** The team's code or id, from the page's URL. */
	readonly key: string;
	readonly onSessionEnded?: () => void;
	readonly log?: {
		notify(message: string, level?: "info" | "warn" | "error"): void;
	};
}

/**
 * The team a team page shows (arc42 ch. 8.17): loads it by its code or id;
 * for non-members asks to join it; for members leaves it; and — for its
 * Admins — renames it, sets, replaces or removes its logo, and deletes it.
 * After a change of the user's own membership it loads the team again, so
 * the page shows what the user may see now.
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

	/** Loads the team; `quietly` keeps showing the current one meanwhile (a refresh). Never throws. */
	async load(quietly = false): Promise<void> {
		if (!quietly || this.current().status !== "loaded") {
			this.store.set({ status: "loading" });
		}
		try {
			this.store.set({
				status: "loaded",
				team: await this.deps.api.get(this.deps.key),
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
			const team = await this.deps.api.rename(this.deps.key, name);
			this.store.set({ status: "loaded", team });
			this.log(`Renamed team ${this.deps.key} to "${team.name}"`);
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
			const team = await this.deps.api.setLogo(this.deps.key, logo);
			this.store.set({ status: "loaded", team });
			this.log(`Set the logo of team ${this.deps.key}`);
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
			await this.deps.api.removeLogo(this.deps.key);
			const updated = team ? { ...team, logoUrl: null } : await this.deps.api.get(this.deps.key);
			this.store.set({ status: "loaded", team: updated });
			this.log(`Removed the logo of team ${this.deps.key}`);
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

	/** The current user asks to join the team; then the page shows the pending request. Never throws. */
	async requestToJoin(): Promise<MembershipOutcome<Team>> {
		try {
			await this.deps.api.requestToJoin(this.deps.key);
			this.log(`Asked to join team ${this.deps.key}`);
			await this.load(true);
			return this.loadedOutcome((m) => m.teamPage.joinFailed);
		} catch (error) {
			this.markMissingOn(error);
			if (error instanceof ApiError && (error.type === TeamApi.JOIN_REQUEST_PENDING || error.type === TeamApi.ALREADY_MEMBER)) {
				await this.load(true);
			}
			return {
				ok: false,
				message: this.failure(error, TeamMessages.forMembership(error, this.nameOrKey(), "change", (m) => m.teamPage.joinFailed)),
			};
		}
	}

	/** The current user leaves the team; then the page shows what non-members see. Never throws. */
	async leave(): Promise<MembershipOutcome<Team>> {
		const name = this.nameOrKey();
		try {
			await this.deps.api.leave(this.deps.key);
			this.log(`Left team ${this.deps.key}`);
			await this.load(true);
			return this.loadedOutcome((m) => m.teamPage.leaveFailed);
		} catch (error) {
			this.markMissingOn(error);
			return {
				ok: false,
				message: this.failure(error, TeamMessages.forMembership(error, name, "leave", (m) => m.teamPage.leaveFailed)),
			};
		}
	}

	/** Deletes the team (its Admins; the page asks first). Never throws. */
	async delete(): Promise<MembershipOutcome<null>> {
		try {
			await this.deps.api.delete(this.deps.key);
			this.log(`Deleted team ${this.deps.key}`);
			this.store.set({ status: "missing" });
			return { ok: true, value: null };
		} catch (error) {
			this.markMissingOn(error);
			if (TeamMessages.isAccessLost(error)) {
				void this.load(true);
			}
			return {
				ok: false,
				message: this.failure(error, TeamMessages.forMembership(error, this.nameOrKey(), "change", (m) => m.teamPage.deleteFailed)),
			};
		}
	}

	private loadedOutcome(fallback: Translatable): MembershipOutcome<Team> {
		const state = this.current();
		if (state.status === "loaded") {
			return { ok: true, value: state.team };
		}
		return { ok: false, message: state.status === "failed" ? state.message : fallback };
	}

	private nameOrKey(): string {
		return this.team()?.name ?? this.deps.key;
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
