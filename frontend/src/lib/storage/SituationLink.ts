import { get, writable, type Readable } from "svelte/store";
import type { SituationSummary } from "./SituationApi";
import { TOP_LEVEL, type SaveTarget } from "./SaveTarget";

/**
 * How the situation in the editor relates to the server:
 * - `unsaved`: never saved there; `origin` says how it was started (its
 *   first save treats a taken title accordingly, arc42 ch. 8.15), `target`
 *   where it was started (its first save creates it there);
 * - `saved`: a server situation, with the metadata of its last known revision.
 */
export type LinkState =
	| { readonly kind: "unsaved"; readonly origin: "new" | "imported"; readonly target: SaveTarget }
	| { readonly kind: "saved"; readonly summary: SituationSummary };

/**
 * Remembers whether the edited situation is a saved server situation, and
 * which revision the next save is based on. Lives next to the editor's
 * situation (a singleton), so it survives navigating between the start page
 * and the editor; it is not part of the situation file.
 */
export class SituationLink {
	private readonly store = writable<LinkState>({ kind: "unsaved", origin: "new", target: TOP_LEVEL });

	readonly state: Readable<LinkState> = { subscribe: this.store.subscribe };

	current(): LinkState {
		return get(this.store);
	}

	/** The saved situation's metadata, or `null` when it was never saved. */
	saved(): SituationSummary | null {
		const state = this.current();
		return state.kind === "saved" ? state.summary : null;
	}

	/** A new situation was created in the app, started at `target` (where its first save goes). */
	startNew(target: SaveTarget = TOP_LEVEL): void {
		this.store.set({ kind: "unsaved", origin: "new", target });
	}

	/** A situation was imported from a file, started at `target` (where its first save goes). */
	startImported(target: SaveTarget = TOP_LEVEL): void {
		this.store.set({ kind: "unsaved", origin: "imported", target });
	}

	/** The editor now holds this server situation (opened, or just saved). */
	attach(summary: SituationSummary): void {
		this.store.set({ kind: "saved", summary });
	}

	/**
	 * The server situation `id` was moved to another folder (e.g. on the start
	 * page while the editor still holds it). Only the folder changes: the
	 * revision the next save is based on stays the editor's.
	 */
	relocate(id: string, folderId: string | null): void {
		const state = this.current();
		if (state.kind === "saved" && state.summary.id === id) {
			this.store.set({ kind: "saved", summary: { ...state.summary, folderId } });
		}
	}

	/** The situation was closed. */
	reset(): void {
		this.startNew();
	}
}

/** The link of the app's `situationEditor`. */
export const situationLink = new SituationLink();
