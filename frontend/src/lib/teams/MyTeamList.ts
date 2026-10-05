import { get, writable, type Readable } from "svelte/store";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import type { MyTeam, Team } from "./TeamApi";
import { TeamMessages, type TeamChange } from "./TeamMessages";

/** The state of the current user's team list. */
export type MyTeamListState =
	| { readonly status: "idle" }
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly teams: readonly MyTeam[] }
	| { readonly status: "failed"; readonly message: Translatable };

export interface MyTeamListDependencies {
	readonly api: {
		listMine(): Promise<MyTeam[]>;
		create(name: string, logo: File | null): Promise<Team>;
	};
	/** Called when the server says the session has ended. */
	readonly onSessionEnded?: () => void;
	readonly log?: {
		notify(message: string, level?: "info" | "warn" | "error"): void;
	};
}

/**
 * The current user's teams on the start page (arc42 ch. 8.17), in the
 * server's order (by name), each with the user's role; and creating a team
 * (the creator becomes its Admin), which reloads the list.
 */
export class MyTeamList {
	private readonly store = writable<MyTeamListState>({ status: "idle" });

	readonly state: Readable<MyTeamListState> = {
		subscribe: this.store.subscribe,
	};

	constructor(private readonly deps: MyTeamListDependencies) {}

	current(): MyTeamListState {
		return get(this.store);
	}

	/** Loads the list. Never throws. */
	async load(): Promise<void> {
		this.store.set({ status: "loading" });
		try {
			this.store.set({
				status: "loaded",
				teams: await this.deps.api.listMine(),
			});
		} catch (error) {
			this.store.set({
				status: "failed",
				message: this.failure(
					error,
					TeamMessages.general(error, (m) => m.teams.loadFailed),
				),
			});
		}
	}

	/** Creates a team named `name` (trimmed by the caller), with `logo` if chosen, and reloads the list. Never throws. */
	async create(name: string, logo: File | null): Promise<TeamChange<Team>> {
		try {
			const team = await this.deps.api.create(name, logo);
			this.log(`Created team "${team.name}" (${team.code})`);
			await this.load();
			return { ok: true, team };
		} catch (error) {
			return {
				ok: false,
				message: this.failure(
					error,
					TeamMessages.forChange(error, name, (m) => m.teams.createFailed),
				),
			};
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
