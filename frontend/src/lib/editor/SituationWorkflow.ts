import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import type { Situation } from "$lib/model/Situation";
import type { NewSituationInput } from "./SituationEditor";
import { TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";

/** The editor operations the workflow uses; implemented by `SituationEditor`. */
export interface WorkflowEditor {
	current(): Situation;
	isDirty(): boolean;
	markSaved(): void;
	load(situation: Situation): void;
	close(): void;
	createNew(input: NewSituationInput): Situation;
	undo(): string | undefined;
	redo(): string | undefined;
}

/** File export/import; implemented by `SituationFileTransfer`. */
export interface SituationFiles {
	export(situation: Situation): string;
	import(file: Blob): Promise<Situation>;
}

/** How the edited situation relates to the server; implemented by `SituationLink`. */
export interface WorkflowLink {
	saved(): unknown;
	startNew(target: SaveTarget): void;
	startImported(target: SaveTarget): void;
	reset(): void;
}

export interface WorkflowLog {
	notify(message: string, level?: "info" | "warn" | "error"): void;
}

export interface SituationWorkflowDependencies {
	readonly editor: WorkflowEditor;
	readonly files: SituationFiles;
	readonly link: WorkflowLink;
	/** Asks the user a yes/no question, e.g. through `ConfirmationPrompt`. */
	readonly confirm: (request: ConfirmationRequest) => Promise<boolean>;
	/**
	 * Whether a user is logged in (saving on the server is possible). Then
	 * only saving on the server counts as saved, not an export (arc42 ch.
	 * 8.7). Default: never (local mode).
	 */
	readonly isLoggedIn?: () => boolean;
	readonly log?: WorkflowLog;
}

/** The question asked before unsaved changes would be thrown away (in local mode: "haven't been exported"). */
export const DISCARD_CHANGES_REQUEST: ConfirmationRequest = {
	title: (m) => m.discard.title,
	message: (m) => m.discard.notExported,
	confirmLabel: (m) => m.discard.confirm,
	cancelLabel: (m) => m.common.cancel,
};

/** The same question when only saving on the server counts as saved ("haven't been saved"). */
export const DISCARD_SAVED_CHANGES_REQUEST: ConfirmationRequest = {
	...DISCARD_CHANGES_REQUEST,
	message: (m) => m.discard.notSaved,
};

/**
 * The situation-level use cases shared by the start page and the editor:
 * new, import, export, undo/redo. Replacing a situation with unsaved
 * changes asks first. "Saved" (arc42 ch. 8.7) means saved on the server for
 * a server situation and for every situation while logged in; only in
 * local mode (not logged in) a situation that isn't on the server counts as
 * saved once it is exported.
 */
export class SituationWorkflow {
	constructor(private readonly deps: SituationWorkflowDependencies) {}

	/** True when nothing unsaved would be lost, or the user agreed to discard it. */
	async confirmDiscardIfDirty(): Promise<boolean> {
		if (!this.deps.editor.isDirty()) {
			return true;
		}
		return this.deps.confirm(this.exportCountsAsSaved() ? DISCARD_CHANGES_REQUEST : DISCARD_SAVED_CHANGES_REQUEST);
	}

	/**
	 * Creates and opens a new situation, started at `target` (where its first
	 * save on the server goes). Call `confirmDiscardIfDirty` before asking for
	 * the input.
	 */
	createNew(input: NewSituationInput, target: SaveTarget = TOP_LEVEL): Situation {
		const created = this.deps.editor.createNew(input);
		this.deps.link.startNew(target);
		this.log(`Created "${created.title}" (${created.fieldType} field)`);
		return created;
	}

	/**
	 * Reads a situation file and opens it, after confirming that unsaved
	 * changes may be discarded; its first save on the server goes to
	 * `target`. Invalid files are reported and change nothing. Returns
	 * whether the imported situation was opened.
	 */
	async importFile(file: File, target: SaveTarget = TOP_LEVEL): Promise<boolean> {
		this.log(`Loading ${file.name}…`);
		let imported: Situation;
		try {
			imported = await this.deps.files.import(file);
		} catch (err) {
			this.log(`Failed to load ${file.name}: ${(err as Error).message}`, "error");
			return false;
		}
		if (!(await this.confirmDiscardIfDirty())) {
			this.log(`Import of ${file.name} cancelled`);
			return false;
		}
		this.deps.editor.load(imported);
		this.deps.link.startImported(target);
		this.log(`Loaded "${imported.displayTitle}" from ${file.name}`);
		return true;
	}

	/**
	 * Leaves the editor for the start page: after confirming that unsaved
	 * changes may be discarded, runs `navigate` and then closes the
	 * situation (so its changes are really discarded and no longer guarded
	 * against leaving the page). Returns whether it left.
	 */
	async leave(navigate: () => unknown): Promise<boolean> {
		if (!(await this.confirmDiscardIfDirty())) {
			this.log("Leaving the editor cancelled");
			return false;
		}
		const title = this.deps.editor.current().displayTitle;
		await navigate();
		this.deps.editor.close();
		this.deps.link.reset();
		this.log(`Closed "${title}"`);
		return true;
	}

	/**
	 * Downloads the current situation. In local mode it then counts as saved;
	 * a server situation, and any situation while logged in, is saved only by
	 * saving it on the server.
	 */
	exportCurrent(): string {
		const situation = this.deps.editor.current();
		const filename = this.deps.files.export(situation);
		if (this.exportCountsAsSaved()) {
			this.deps.editor.markSaved();
		}
		this.log(`Exported ${situation.frames.length} frame(s) to ${filename}`);
		return filename;
	}

	/** Undoes the active frame's last step; logs only when there was one. */
	undo(): void {
		const label = this.deps.editor.undo();
		if (label) {
			this.log(`Undo: ${label}`);
		}
	}

	/** Redoes the active frame's last undone step; logs only when there was one. */
	redo(): void {
		const label = this.deps.editor.redo();
		if (label) {
			this.log(`Redo: ${label}`);
		}
	}

	/** Local mode with a situation that isn't on the server: exporting it saves it (arc42 ch. 8.7). */
	private exportCountsAsSaved(): boolean {
		return !this.deps.link.saved() && !(this.deps.isLoggedIn?.() ?? false);
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
