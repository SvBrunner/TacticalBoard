import { get, writable, type Readable } from "svelte/store";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import { TeamApi, type TeamSearchPage, type TeamSummary } from "./TeamApi";
import { TeamMessages } from "./TeamMessages";

/** The state of the team overview. */
export type TeamOverviewState =
	| { readonly status: "idle" }
	| { readonly status: "loading"; readonly query: string }
	| {
			readonly status: "loaded";
			/** The search text the teams match (trimmed; empty: all teams). */
			readonly query: string;
			readonly teams: readonly TeamSummary[];
			/** How many teams match in total; more than `teams.length` means "Show more". */
			readonly total: number;
			/** Whether the next page is being loaded. */
			readonly loadingMore: boolean;
	  }
	| {
			readonly status: "failed";
			readonly query: string;
			readonly message: Translatable;
	  };

export interface TeamOverviewDependencies {
	readonly api: {
		search(text: string, offset: number, limit: number): Promise<TeamSearchPage>;
	};
	/** Waits before searching while the user types (default: `setTimeout`). */
	readonly schedule?: (run: () => void, delayMs: number) => () => void;
	readonly pageSize?: number;
	readonly onSessionEnded?: () => void;
	readonly log?: {
		notify(message: string, level?: "info" | "warn" | "error"): void;
	};
}

const timeout = (run: () => void, delayMs: number) => {
	const handle = setTimeout(run, delayMs);
	return () => clearTimeout(handle);
};

/**
 * The team overview (arc42 ch. 8.17): all teams, or those whose name or code
 * contains the search text (the server compares ignoring case), a page at a
 * time with "Show more". Typing searches after a short pause; an answer to an
 * older search is ignored when a newer one was started.
 */
export class TeamOverview {
	/** How long typing has to pause before the search runs. */
	static readonly TYPING_DELAY_MS = 300;

	private readonly store = writable<TeamOverviewState>({ status: "idle" });
	private generation = 0;
	private cancelPending: (() => void) | null = null;

	readonly state: Readable<TeamOverviewState> = {
		subscribe: this.store.subscribe,
	};

	constructor(private readonly deps: TeamOverviewDependencies) {}

	current(): TeamOverviewState {
		return get(this.store);
	}

	private get pageSize(): number {
		return this.deps.pageSize ?? TeamApi.PAGE_SIZE;
	}

	/** The user typed `text`: searches for it after a short pause. */
	type(text: string): void {
		this.cancelPending?.();
		const schedule = this.deps.schedule ?? timeout;
		this.cancelPending = schedule(() => {
			this.cancelPending = null;
			void this.search(text);
		}, TeamOverview.TYPING_DELAY_MS);
	}

	/** Searches for `text` at once (empty: all teams), from the first page. Never throws. */
	async search(text: string): Promise<void> {
		this.cancelPending?.();
		this.cancelPending = null;
		const query = text.trim();
		const generation = ++this.generation;
		this.store.set({ status: "loading", query });
		try {
			const page = await this.deps.api.search(query, 0, this.pageSize);
			if (generation === this.generation) {
				this.store.set({
					status: "loaded",
					query,
					teams: page.items,
					total: page.total,
					loadingMore: false,
				});
			}
		} catch (error) {
			if (generation === this.generation) {
				this.store.set({
					status: "failed",
					query,
					message: this.failure(error),
				});
			}
		}
	}

	/** Loads the next page of the current result, if there is one. Never throws. */
	async showMore(): Promise<void> {
		const state = this.current();
		if (state.status !== "loaded" || state.loadingMore || state.teams.length >= state.total) {
			return;
		}
		const generation = this.generation;
		this.store.set({ ...state, loadingMore: true });
		try {
			const page = await this.deps.api.search(state.query, state.teams.length, this.pageSize);
			if (generation === this.generation) {
				const known = new Set(state.teams.map((team) => team.id));
				const teams = [...state.teams, ...page.items.filter((team) => !known.has(team.id))];
				this.store.set({
					status: "loaded",
					query: state.query,
					teams,
					total: page.total,
					loadingMore: false,
				});
			}
		} catch (error) {
			if (generation === this.generation) {
				this.store.set({
					status: "failed",
					query: state.query,
					message: this.failure(error),
				});
			}
		}
	}

	/** Stops a pending search (the page is left). */
	dispose(): void {
		this.cancelPending?.();
		this.cancelPending = null;
		this.generation++;
	}

	private failure(error: unknown): Translatable {
		if (TeamMessages.isSessionEnded(error)) {
			this.deps.onSessionEnded?.();
		}
		const message = TeamMessages.general(error, (m) => m.teamOverview.loadFailed);
		this.deps.log?.notify(inEnglish(message), "error");
		return message;
	}
}
