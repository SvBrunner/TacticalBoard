import { get, writable, type Readable } from "svelte/store";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import type { Area } from "./Area";
import type { Folder, FolderSummary } from "./FolderApi";
import { FolderMessages, type FolderChange } from "./FolderMessages";

/** The folder list's state. */
export type FolderListState =
	| { readonly status: "idle" }
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly folders: readonly FolderSummary[] }
	| { readonly status: "failed"; readonly message: Translatable };

export interface FolderListDependencies {
	readonly api: {
		list(area: Area): Promise<FolderSummary[]>;
		create(area: Area, name: string): Promise<Folder>;
	};
	/**
	 * Whose folders: the personal area (start page), a team's (team page), or
	 * the area of the folder a folder's page shows — `null` while it isn't
	 * known yet (then `load` does nothing).
	 */
	readonly area: () => Area | null;
	/** Called when the server says the session has ended. */
	readonly onSessionEnded?: () => void;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * The folders of one area (arc42 ch. 8.15) — the personal area or a team's —
 * in the server's order (by name), each with the number of situations in it:
 * listed on the start page and a team's page, and offered as targets when
 * moving a situation. Creating a folder reloads the list.
 */
export class FolderList {
	private readonly store = writable<FolderListState>({ status: "idle" });

	readonly state: Readable<FolderListState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: FolderListDependencies) {}

	current(): FolderListState {
		return get(this.store);
	}

	/** The listed folders, or none while not loaded. */
	folders(): readonly FolderSummary[] {
		const state = this.current();
		return state.status === "loaded" ? state.folders : [];
	}

	/** Loads the list (nothing while the area isn't known). Never throws. */
	async load(): Promise<void> {
		const area = this.deps.area();
		if (area === null) {
			return;
		}
		this.store.set({ status: "loading" });
		try {
			this.store.set({ status: "loaded", folders: await this.deps.api.list(area) });
		} catch (error) {
			this.store.set({ status: "failed", message: this.failure(error, (m) => m.folders.loadFailed) });
		}
	}

	/** Creates a folder named `name` (trimmed by the caller) and reloads the list. Never throws. */
	async create(name: string): Promise<FolderChange<Folder>> {
		const area = this.deps.area();
		if (area === null) {
			return { ok: false, message: (m) => m.folders.createFailed };
		}
		try {
			const folder = await this.deps.api.create(area, name);
			this.log(`Created folder "${folder.name}"`);
			await this.load();
			return { ok: true, folder };
		} catch (error) {
			return { ok: false, message: this.failure(error, (m) => m.folders.createFailed, name) };
		}
	}

	private failure(error: unknown, fallback: Translatable, name?: string): Translatable {
		if (FolderMessages.isSessionEnded(error)) {
			this.deps.onSessionEnded?.();
		}
		const message = name === undefined ? FolderMessages.general(error, fallback) : FolderMessages.forNameChange(error, name, fallback);
		this.log(inEnglish(message), "error");
		return message;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
