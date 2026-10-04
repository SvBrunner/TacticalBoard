import { get, writable, type Readable } from "svelte/store";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { FolderApi } from "./FolderApi";
import type { SituationSummary } from "./SituationApi";
import type { SaveTarget } from "./SaveTarget";

/** The list's state on the start page or a folder's page. */
export type SavedListState =
	| { readonly status: "idle" }
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly situations: readonly SituationSummary[] }
	| { readonly status: "failed"; readonly message: string };

export interface SavedSituationListDependencies {
	readonly api: {
		list(place: SaveTarget): Promise<SituationSummary[]>;
		delete(id: string): Promise<void>;
		move(id: string, folderId: string | null): Promise<SituationSummary>;
	};
	/** Which situations: the top level of the personal area, or a folder. */
	readonly place: SaveTarget;
	/** Told about a move, so the editor's server situation knows its new folder. */
	readonly link?: { relocate(id: string, folderId: string | null): void };
	/** Called when the server says the session has ended. */
	readonly onSessionEnded?: () => void;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * The saved situations of one place of the personal area — its top level
 * (start page) or a folder (the folder's page) — in the server's order: most
 * recently changed first. Deleting and moving ask the server and then reload
 * the list (a moved situation leaves it).
 */
export class SavedSituationList {
	private readonly store = writable<SavedListState>({ status: "idle" });

	readonly state: Readable<SavedListState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: SavedSituationListDependencies) {}

	current(): SavedListState {
		return get(this.store);
	}

	/** The listed situations, or none while not loaded. */
	situations(): readonly SituationSummary[] {
		const state = this.current();
		return state.status === "loaded" ? state.situations : [];
	}

	/** Loads the list. Never throws. */
	async load(): Promise<void> {
		this.store.set({ status: "loading" });
		try {
			const situations = await this.deps.api.list(this.deps.place);
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

	/**
	 * Moves a situation into the folder `folderId` of its area (or to the top
	 * level, `null`) and reloads the list; resolves with whether it was moved.
	 * Never throws.
	 */
	async move(situation: SituationSummary, folderId: string | null): Promise<boolean> {
		try {
			const moved = await this.deps.api.move(situation.id, folderId);
			this.deps.link?.relocate(moved.id, moved.folderId);
			this.log(`Moved "${situation.title}" to ${folderId === null ? "the top level" : `folder ${folderId}`}`);
		} catch (error) {
			this.store.set({ status: "failed", message: this.moveFailure(error, situation) });
			return false;
		}
		await this.load();
		return true;
	}

	private moveFailure(error: unknown, situation: SituationSummary): string {
		if (error instanceof ApiError && error.type === FolderApi.NOT_FOUND) {
			return `"${situation.title}" couldn't be moved: the folder no longer exists.`;
		}
		if (error instanceof ApiError && error.status === 404) {
			return `"${situation.title}" couldn't be moved: it no longer exists.`;
		}
		return this.messageFor(error, `"${situation.title}" couldn't be moved.`);
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
