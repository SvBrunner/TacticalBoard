import { get, writable, type Readable } from "svelte/store";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import type { SituationSummary } from "./SituationApi";

/** The list's state on the start page. */
export type SavedListState =
	| { readonly status: "idle" }
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly situations: readonly SituationSummary[] }
	| { readonly status: "failed"; readonly message: string };

export interface SavedSituationListDependencies {
	readonly api: {
		listPersonal(): Promise<SituationSummary[]>;
		delete(id: string): Promise<void>;
	};
	/** Called when the server says the session has ended. */
	readonly onSessionEnded?: () => void;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * The saved situations of the personal area, as listed on the start page
 * (in the server's order: most recently changed first). Deleting asks the
 * server and then reloads the list.
 */
export class SavedSituationList {
	private readonly store = writable<SavedListState>({ status: "idle" });

	readonly state: Readable<SavedListState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: SavedSituationListDependencies) {}

	current(): SavedListState {
		return get(this.store);
	}

	/** Loads the list. Never throws. */
	async load(): Promise<void> {
		this.store.set({ status: "loading" });
		try {
			const situations = await this.deps.api.listPersonal();
			this.store.set({ status: "loaded", situations });
		} catch (error) {
			this.store.set({ status: "failed", message: this.messageFor(error, "The saved situations couldn't be loaded.") });
		}
	}

	/** Deletes a situation and reloads the list; resolves with whether it was deleted. Never throws. */
	async delete(situation: SituationSummary): Promise<boolean> {
		try {
			await this.deps.api.delete(situation.id);
			this.log(`Deleted "${situation.title}"`);
		} catch (error) {
			if (!(error instanceof ApiError && error.status === 404)) {
				this.store.set({ status: "failed", message: this.messageFor(error, `"${situation.title}" couldn't be deleted.`) });
				return false;
			}
			// Already gone (e.g. deleted in another tab): the reload shows that.
		}
		await this.load();
		return true;
	}

	private messageFor(error: unknown, fallback: string): string {
		if (error instanceof ApiUnavailableError) {
			return "The server is not reachable. Please try again later.";
		}
		if (error instanceof ApiError && error.status === 401) {
			this.deps.onSessionEnded?.();
			return "Your session has ended. Please log in again.";
		}
		this.log(fallback, "error");
		return fallback;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
