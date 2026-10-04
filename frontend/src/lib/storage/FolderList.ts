import { get, writable, type Readable } from "svelte/store";
import type { Folder } from "./FolderApi";
import { FolderMessages, type FolderChange } from "./FolderMessages";

/** The folder list's state. */
export type FolderListState =
	| { readonly status: "idle" }
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly folders: readonly Folder[] }
	| { readonly status: "failed"; readonly message: string };

export interface FolderListDependencies {
	readonly api: {
		listPersonal(): Promise<Folder[]>;
		createPersonal(name: string): Promise<Folder>;
	};
	/** Called when the server says the session has ended. */
	readonly onSessionEnded?: () => void;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * The folders of the personal area (arc42 ch. 8.15), in the server's order
 * (by name): listed on the start page and offered as targets when moving a
 * situation. Creating a folder reloads the list.
 */
export class FolderList {
	private readonly store = writable<FolderListState>({ status: "idle" });

	readonly state: Readable<FolderListState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: FolderListDependencies) {}

	current(): FolderListState {
		return get(this.store);
	}

	/** The listed folders, or none while not loaded. */
	folders(): readonly Folder[] {
		const state = this.current();
		return state.status === "loaded" ? state.folders : [];
	}

	/** Loads the list. Never throws. */
	async load(): Promise<void> {
		this.store.set({ status: "loading" });
		try {
			this.store.set({ status: "loaded", folders: await this.deps.api.listPersonal() });
		} catch (error) {
			this.store.set({ status: "failed", message: this.failure(error, "The folders couldn't be loaded.") });
		}
	}

	/** Creates a folder named `name` (trimmed by the caller) and reloads the list. Never throws. */
	async create(name: string): Promise<FolderChange<Folder>> {
		try {
			const folder = await this.deps.api.createPersonal(name);
			this.log(`Created folder "${folder.name}"`);
			await this.load();
			return { ok: true, folder };
		} catch (error) {
			return { ok: false, message: this.failure(error, `The folder couldn't be created.`, name) };
		}
	}

	private failure(error: unknown, fallback: string, name?: string): string {
		if (FolderMessages.isSessionEnded(error)) {
			this.deps.onSessionEnded?.();
		}
		const message = name === undefined ? FolderMessages.general(error, fallback) : FolderMessages.forNameChange(error, name, fallback);
		this.log(message, "error");
		return message;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
