import { get, writable, type Readable } from "svelte/store";
import { ApiError } from "$lib/api/ApiClient";
import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import { FolderApi, type Folder } from "./FolderApi";
import { FolderMessages, type FolderChange, type FolderDeletion } from "./FolderMessages";

/** The outcome of the user's "Delete folder". */
export type DeleteRequestOutcome =
	| { readonly status: "deleted" }
	| { readonly status: "cancelled" }
	/** Not deleted, and why (e.g. it still contains situations). */
	| { readonly status: "refused"; readonly message: Translatable };

/** The state of the folder shown on its page. */
export type CurrentFolderState =
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly folder: Folder }
	/** It doesn't exist (any more), or belongs to someone else. */
	| { readonly status: "missing" }
	| { readonly status: "failed"; readonly message: Translatable };

export interface CurrentFolderDependencies {
	readonly api: {
		get(id: string): Promise<Folder>;
		rename(id: string, name: string): Promise<Folder>;
		delete(id: string): Promise<void>;
	};
	readonly id: string;
	/** Called when the server says the session has ended. */
	readonly onSessionEnded?: () => void;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * The folder a folder page shows (arc42 ch. 8.15): loads it, renames it, and
 * deletes it — which the server refuses while it still contains situations;
 * that reason is passed on to the user.
 */
export class CurrentFolder {
	private readonly store = writable<CurrentFolderState>({ status: "loading" });

	readonly state: Readable<CurrentFolderState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: CurrentFolderDependencies) {}

	current(): CurrentFolderState {
		return get(this.store);
	}

	/** The folder's name, if loaded. */
	name(): string | null {
		const state = this.current();
		return state.status === "loaded" ? state.folder.name : null;
	}

	/** Loads the folder. Never throws. */
	async load(): Promise<void> {
		this.store.set({ status: "loading" });
		try {
			this.store.set({ status: "loaded", folder: await this.deps.api.get(this.deps.id) });
		} catch (error) {
			if (error instanceof ApiError && error.status === 404) {
				this.store.set({ status: "missing" });
				return;
			}
			this.store.set({ status: "failed", message: this.failure(error, (m) => m.folders.loadOneFailed) });
		}
	}

	/** Renames the folder. Never throws. */
	async rename(name: string): Promise<FolderChange<Folder>> {
		try {
			const folder = await this.deps.api.rename(this.deps.id, name);
			this.store.set({ status: "loaded", folder });
			this.log(`Renamed folder to "${folder.name}"`);
			return { ok: true, folder };
		} catch (error) {
			this.markMissingOn(error);
			return { ok: false, message: this.failure(error, (m) => m.folders.renameFailed, name) };
		}
	}

	/**
	 * The user's "Delete folder": a folder known to contain situations is
	 * refused at once with the reason (arc42 ch. 1: only empty folders can be
	 * deleted); otherwise "Delete folder?" is asked through `confirm` before
	 * deleting — the server still refuses if situations got into it meanwhile.
	 * Never throws.
	 */
	async requestDelete(options: {
		readonly containsSituations: boolean;
		readonly confirm: (request: ConfirmationRequest) => Promise<boolean>;
	}): Promise<DeleteRequestOutcome> {
		const name = this.name();
		if (options.containsSituations) {
			return { status: "refused", message: FolderMessages.notEmpty(name) };
		}
		const confirmed = await options.confirm({
			title: (m) => m.folders.deleteQuestion,
			message: (m) => m.folders.deleteMessage(name),
			confirmLabel: (m) => m.common.delete,
			cancelLabel: (m) => m.common.cancel,
		});
		if (!confirmed) {
			return { status: "cancelled" };
		}
		const deletion = await this.delete();
		return deletion.ok ? { status: "deleted" } : { status: "refused", message: deletion.message };
	}

	/** Deletes the (empty) folder; one that is already gone counts as deleted. Never throws. */
	async delete(): Promise<FolderDeletion> {
		const name = this.name();
		try {
			await this.deps.api.delete(this.deps.id);
			this.store.set({ status: "missing" });
			this.log(`Deleted folder "${name ?? this.deps.id}"`);
			return { ok: true };
		} catch (error) {
			if (error instanceof ApiError && error.type === FolderApi.NOT_EMPTY) {
				return { ok: false, message: FolderMessages.notEmpty(name) };
			}
			if (error instanceof ApiError && error.type === FolderApi.NOT_FOUND) {
				// Already gone (e.g. deleted in another tab).
				this.store.set({ status: "missing" });
				return { ok: true };
			}
			return { ok: false, message: this.failure(error, (m) => m.folders.deleteFailed(name)) };
		}
	}

	private markMissingOn(error: unknown): void {
		if (error instanceof ApiError && error.type === FolderApi.NOT_FOUND) {
			this.store.set({ status: "missing" });
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
