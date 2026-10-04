import { get, writable, type Readable } from "svelte/store";
import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import { EditorRoute } from "$lib/editor/EditorRoute";
import type { Translatable } from "$lib/i18n/Messages";
import type { OpenOutcome } from "./SituationOpener";
import type { SituationSummary } from "./SituationApi";

/** What a list of saved situations shows besides the list: an open in progress, the last failure. */
export interface SavedActionsState {
	readonly opening: boolean;
	/** Why the last open failed, or `null`. */
	readonly error: Translatable | null;
}

export interface SavedSituationActionsDependencies {
	/** The list the actions work on (reloaded after a failed open, a delete or a move). */
	readonly list: {
		load(): Promise<void>;
		delete(situation: SituationSummary): Promise<boolean>;
		move(situation: SituationSummary, folderId: string | null): Promise<boolean>;
	};
	readonly opener: { open(id: string, confirmDiscard: () => Promise<boolean>): Promise<OpenOutcome> };
	/** "Discard changes?" if the editor has unsaved changes (true: go ahead). */
	readonly confirmDiscard: () => Promise<boolean>;
	/** Asks a yes/no question, e.g. through `ConfirmationPrompt`. */
	readonly confirm: (request: ConfirmationRequest) => Promise<boolean>;
	/** Navigates within the app (`goto`). */
	readonly navigate: (url: string) => Promise<unknown>;
}

/**
 * The actions on a listed saved situation, shared by the start page and a
 * folder's page (arc42 ch. 8.15): open it in the editor (after "Discard
 * changes?" if needed), delete it (after "Delete situation?"), move it to
 * another folder of its area.
 */
export class SavedSituationActions {
	private readonly store = writable<SavedActionsState>({ opening: false, error: null });

	readonly state: Readable<SavedActionsState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: SavedSituationActionsDependencies) {}

	current(): SavedActionsState {
		return get(this.store);
	}

	/** Opens the situation in the editor; a failure is shown and the list reloaded. */
	async open(situation: SituationSummary): Promise<void> {
		this.store.set({ opening: true, error: null });
		try {
			const outcome = await this.deps.opener.open(situation.id, this.deps.confirmDiscard);
			if (outcome.status === "opened") {
				await this.deps.navigate(EditorRoute.forSaved(situation.id));
			} else if (outcome.status === "failed") {
				const reason = outcome.message;
				const error: Translatable = (m) => `${m.saved.openFailed(situation.title)} ${reason(m)}`;
				this.store.update((state) => ({ ...state, error }));
				void this.deps.list.load();
			}
		} finally {
			this.store.update((state) => ({ ...state, opening: false }));
		}
	}

	/** Deletes the situation after "Delete situation?"; resolves with whether it was deleted. */
	async delete(situation: SituationSummary): Promise<boolean> {
		this.clearError();
		const confirmed = await this.deps.confirm({
			title: (m) => m.saved.deleteQuestion,
			message: (m) => m.saved.deleteMessage(situation.title),
			confirmLabel: (m) => m.common.delete,
			cancelLabel: (m) => m.common.cancel,
		});
		return confirmed && (await this.deps.list.delete(situation));
	}

	/** Moves the situation into the folder `folderId` (or the top level); resolves with whether it was moved. */
	async move(situation: SituationSummary, folderId: string | null): Promise<boolean> {
		this.clearError();
		return this.deps.list.move(situation, folderId);
	}

	private clearError(): void {
		this.store.update((state) => ({ ...state, error: null }));
	}
}
