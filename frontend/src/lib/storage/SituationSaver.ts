import { get, writable, type Readable } from "svelte/store";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import type { SavedIdentity, SaveBasis } from "$lib/editor/SituationEditor";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import { ProblemText } from "$lib/i18n/ProblemText";
import type { Situation } from "$lib/model/Situation";
import type { SituationFileDto } from "$lib/model/serialization/SituationFileDto";
import { FolderApi } from "./FolderApi";
import { SituationApi, type CreateOptions, type SituationOrigin, type SituationSummary, type StoredSituation } from "./SituationApi";
import type { LinkState } from "./SituationLink";
import type { SaveTarget } from "./SaveTarget";

/** What the user chooses when someone else saved the situation in the meantime (arc42 ch. 8.15). */
export type ConflictChoice = "overwrite" | "copy" | "cancel";

/** The state of saving, for the editor's feedback. */
export type SaveState =
	| { readonly status: "idle" }
	| { readonly status: "saving" }
	| { readonly status: "saved"; readonly title: string }
	| { readonly status: "failed"; readonly message: Translatable };

/** The editor operations a save needs; implemented by `SituationEditor`. */
export interface SaveEditor {
	current(): Situation;
	changeCount(): number;
	/** Whether there are changes since the situation was loaded or last saved. */
	isDirty(): boolean;
	acknowledgeSave(saved: SavedIdentity, basis: SaveBasis): void;
}

/** The server calls a save needs; implemented by `SituationApi`. */
export interface SaveApi {
	create(document: unknown, origin: SituationOrigin, target: SaveTarget, options?: CreateOptions): Promise<StoredSituation>;
	update(id: string, revision: number, document: unknown): Promise<StoredSituation>;
}

/** Situation ↔ document; implemented by `SituationSerializer`. */
export interface SaveSerializer {
	toDocument(situation: Situation): SituationFileDto;
	fromDocument(raw: unknown): Situation;
}

/** The link to the server situation; implemented by `SituationLink`. */
export interface SaveLink {
	current(): LinkState;
	attach(summary: SituationSummary): void;
}

export interface SituationSaverDependencies {
	readonly editor: SaveEditor;
	readonly link: SaveLink;
	readonly api: SaveApi;
	readonly serializer: SaveSerializer;
	/** Asks the user what to do about a save conflict (Overwrite / Save as copy / Cancel). */
	readonly chooseOnConflict: () => Promise<ConflictChoice>;
	/** Called when the server says the session has ended (e.g. to refresh the login state). */
	readonly onSessionEnded?: () => void;
	/** Called after every successful save with the server's state. */
	readonly onSaved?: (saved: StoredSituation) => void;
	/**
	 * Whether a title is a default title in any language (arc42 ch. 8.18);
	 * the first save of such a new situation asks the server to number it
	 * instead of refusing a taken title. Default: none is.
	 */
	readonly isDefaultTitle?: (title: string) => boolean;
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * Saves the edited situation on the server (arc42 ch. 8.15). There is
 * something to save when the situation was never saved on the server (also
 * without edits) or has changes since its last save; otherwise saving does
 * nothing (the Save button is disabled, arc42 ch. 8.7): the first save
 * creates it where it was started (a folder of the personal area or its top
 * level, `LinkState.target`), later saves update it on top of the revision
 * they are based on. A save conflict asks the user: overwrite (save again on
 * top of the newest revision), save as a copy (a new situation in the same
 * folder or top level as the original), or cancel. Afterwards the editor shows the server's state (id,
 * title, timestamps) and is clean. Failures (e.g. a taken title) end up in
 * `state` as a message for the editor.
 */
export class SituationSaver {
	private readonly store = writable<SaveState>({ status: "idle" });

	readonly state: Readable<SaveState> = { subscribe: this.store.subscribe };

	constructor(private readonly deps: SituationSaverDependencies) {}

	current(): SaveState {
		return get(this.store);
	}

	/** Whether a save is running (a second one is ignored meanwhile). */
	isSaving(): boolean {
		return this.current().status === "saving";
	}

	/** Forgets a shown result (e.g. the user dismissed the message). */
	dismiss(): void {
		if (!this.isSaving()) {
			this.store.set({ status: "idle" });
		}
	}

	/** Whether there is something to save: a never-saved situation, or changes since the last save. */
	static hasChanges(link: LinkState, dirty: boolean): boolean {
		return link.kind === "unsaved" || dirty;
	}

	/** Whether there is something to save right now. */
	hasChanges(): boolean {
		return SituationSaver.hasChanges(this.deps.link.current(), this.deps.editor.isDirty());
	}

	/** Saves the current situation; resolves with whether it was saved. Does nothing without changes. Never throws. */
	async save(): Promise<boolean> {
		if (this.isSaving()) {
			return false;
		}
		if (!this.hasChanges()) {
			this.log("Nothing to save");
			return false;
		}
		this.store.set({ status: "saving" });
		const basis: SaveBasis = { situation: this.deps.editor.current(), changeCount: this.deps.editor.changeCount() };
		const document = this.deps.serializer.toDocument(basis.situation);
		try {
			const stored = await this.send(document, this.deps.link.current());
			if (!stored) {
				this.store.set({ status: "idle" });
				this.log("Save cancelled");
				return false;
			}
			this.apply(stored, basis);
			return true;
		} catch (error) {
			const message = this.messageFor(error, basis.situation);
			this.store.set({ status: "failed", message });
			this.log(`Save failed: ${inEnglish(message)}`, "error");
			return false;
		}
	}

	/** The server's answer, or `null` when the user cancelled a conflict. */
	private async send(document: SituationFileDto, link: LinkState): Promise<StoredSituation | null> {
		if (link.kind === "unsaved") {
			const titleIsDefault = link.origin === "new" && (this.deps.isDefaultTitle?.(document.situation.title) ?? false);
			return this.deps.api.create(document, link.origin, link.target, titleIsDefault ? { titleIsDefault } : undefined);
		}
		let revision = link.summary.revision;
		for (;;) {
			try {
				return await this.deps.api.update(link.summary.id, revision, document);
			} catch (error) {
				if (!(error instanceof ApiError && error.type === SituationApi.SAVE_CONFLICT)) {
					throw error;
				}
				const choice = await this.deps.chooseOnConflict();
				if (choice === "cancel") {
					return null;
				}
				if (choice === "copy") {
					return this.deps.api.create(document, "copy", { folderId: link.summary.folderId });
				}
				revision = SituationSaver.currentRevisionOf(error) ?? revision;
			}
		}
	}

	private apply(stored: StoredSituation, basis: SaveBasis): void {
		const saved = this.deps.serializer.fromDocument(stored.document);
		this.deps.editor.acknowledgeSave(
			{ id: saved.id, title: saved.title, createdAt: saved.createdAt, updatedAt: saved.updatedAt },
			basis,
		);
		const { document: _document, ...summary } = stored;
		this.deps.link.attach(summary);
		this.store.set({ status: "saved", title: stored.title });
		this.log(`Saved "${stored.title}" (revision ${stored.revision})`);
		this.deps.onSaved?.(stored);
	}

	private messageFor(error: unknown, situation: Situation): Translatable {
		if (error instanceof ApiUnavailableError) {
			return (m) => m.saving.unreachable;
		}
		if (!(error instanceof ApiError)) {
			return (m) => m.saving.failed;
		}
		if (error.status === 401) {
			this.deps.onSessionEnded?.();
			return (m) => m.saving.sessionEnded;
		}
		if (error.type === SituationApi.DUPLICATE_TITLE) {
			const title = situation.displayTitle.trim();
			return (m) => m.saving.duplicateTitle(title);
		}
		if (error.type === SituationApi.NOT_FOUND) {
			return (m) => m.saving.situationGone;
		}
		if (error.type === FolderApi.NOT_FOUND) {
			return (m) => m.saving.folderGone;
		}
		const reason = ProblemText.describe(error, () => "");
		return (m) => {
			const text = reason(m);
			return text === "" ? m.saving.failed : m.saving.failedWith(text);
		};
	}

	private static currentRevisionOf(error: ApiError): number | undefined {
		const revision = error.problem?.currentRevision;
		return typeof revision === "number" && Number.isInteger(revision) && revision > 0 ? revision : undefined;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
