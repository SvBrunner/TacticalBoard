import { get, writable, type Readable } from "svelte/store";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import type { SavedIdentity, SaveBasis } from "$lib/editor/SituationEditor";
import type { Situation } from "$lib/model/Situation";
import type { SituationFileDto } from "$lib/model/serialization/SituationFileDto";
import { SituationApi, type SituationOrigin, type SituationSummary, type StoredSituation } from "./SituationApi";
import type { LinkState } from "./SituationLink";

/** What the user chooses when someone else saved the situation in the meantime (arc42 ch. 8.15). */
export type ConflictChoice = "overwrite" | "copy" | "cancel";

/** The state of saving, for the editor's feedback. */
export type SaveState =
	| { readonly status: "idle" }
	| { readonly status: "saving" }
	| { readonly status: "saved"; readonly title: string }
	| { readonly status: "failed"; readonly message: string };

/** The editor operations a save needs; implemented by `SituationEditor`. */
export interface SaveEditor {
	current(): Situation;
	changeCount(): number;
	acknowledgeSave(saved: SavedIdentity, basis: SaveBasis): void;
}

/** The server calls a save needs; implemented by `SituationApi`. */
export interface SaveApi {
	create(document: unknown, origin: SituationOrigin): Promise<StoredSituation>;
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
	readonly log?: { notify(message: string, level?: "info" | "warn" | "error"): void };
}

/**
 * Saves the edited situation on the server (arc42 ch. 8.15): the first save
 * creates it in the personal area (at the top level), later saves update it
 * on top of the revision they are based on. A save conflict asks the user:
 * overwrite (save again on top of the newest revision), save as a copy (a new
 * situation), or cancel. Afterwards the editor shows the server's state (id,
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

	/** Saves the current situation; resolves with whether it was saved. Never throws. */
	async save(): Promise<boolean> {
		if (this.isSaving()) {
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
			this.log(`Save failed: ${message}`, "error");
			return false;
		}
	}

	/** The server's answer, or `null` when the user cancelled a conflict. */
	private async send(document: SituationFileDto, link: LinkState): Promise<StoredSituation | null> {
		if (link.kind === "unsaved") {
			return this.deps.api.create(document, link.origin);
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
					return this.deps.api.create(document, "copy");
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

	private messageFor(error: unknown, situation: Situation): string {
		if (error instanceof ApiUnavailableError) {
			return "The server is not reachable. The situation is not saved yet; try again later or export it.";
		}
		if (!(error instanceof ApiError)) {
			return "The situation couldn't be saved.";
		}
		if (error.status === 401) {
			this.deps.onSessionEnded?.();
			return "Your session has ended. Log in again to save; until then you can export the situation.";
		}
		if (error.type === SituationApi.DUPLICATE_TITLE) {
			return `A situation titled "${situation.displayTitle.trim()}" already exists. Choose another title and save again.`;
		}
		if (error.type === SituationApi.NOT_FOUND) {
			return "This situation no longer exists on the server (it was deleted). Export it to keep your changes.";
		}
		const details = error.fieldErrors();
		return details.length > 0
			? `The situation couldn't be saved: ${details.join("; ")}`
			: `The situation couldn't be saved: ${error.message}`;
	}

	private static currentRevisionOf(error: ApiError): number | undefined {
		const revision = error.problem?.currentRevision;
		return typeof revision === "number" && Number.isInteger(revision) && revision > 0 ? revision : undefined;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
