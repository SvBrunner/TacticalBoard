import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import type { Situation } from "$lib/model/Situation";
import type { NewSituationInput } from "./SituationEditor";

/** The editor operations the workflow uses; implemented by `SituationEditor`. */
export interface WorkflowEditor {
	current(): Situation;
	isDirty(): boolean;
	markSaved(): void;
	load(situation: Situation): void;
	createNew(input: NewSituationInput): Situation;
	undo(): string | undefined;
	redo(): string | undefined;
}

/** File export/import; implemented by `SituationFileTransfer`. */
export interface SituationFiles {
	export(situation: Situation): string;
	import(file: Blob): Promise<Situation>;
}

export interface WorkflowLog {
	notify(message: string, level?: "info" | "warn" | "error"): void;
}

export interface SituationWorkflowDependencies {
	readonly editor: WorkflowEditor;
	readonly files: SituationFiles;
	/** Asks the user a yes/no question, e.g. through `ConfirmationPrompt`. */
	readonly confirm: (request: ConfirmationRequest) => Promise<boolean>;
	readonly log?: WorkflowLog;
}

/** The question asked before unsaved changes would be thrown away. */
export const DISCARD_CHANGES_REQUEST: ConfirmationRequest = {
	title: "Discard changes?",
	message: "The current situation has changes that haven't been exported. They will be lost.",
	confirmLabel: "Discard",
	cancelLabel: "Cancel",
};

/**
 * The situation-level use cases shared by the start page and the editor:
 * new, import, export, undo/redo. Replacing a situation with unsaved
 * changes (in the MVP: not exported since the last edit) asks first.
 */
export class SituationWorkflow {
	constructor(private readonly deps: SituationWorkflowDependencies) {}

	/** True when nothing unsaved would be lost, or the user agreed to discard it. */
	async confirmDiscardIfDirty(): Promise<boolean> {
		if (!this.deps.editor.isDirty()) {
			return true;
		}
		return this.deps.confirm(DISCARD_CHANGES_REQUEST);
	}

	/** Creates and opens a new situation. Call `confirmDiscardIfDirty` before asking for the input. */
	createNew(input: NewSituationInput): Situation {
		const created = this.deps.editor.createNew(input);
		this.log(`Created "${created.title}" (${created.fieldType} field)`);
		return created;
	}

	/**
	 * Reads a situation file and opens it, after confirming that unsaved
	 * changes may be discarded. Invalid files are reported and change
	 * nothing. Returns whether the imported situation was opened.
	 */
	async importFile(file: File): Promise<boolean> {
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
		this.log(`Loaded "${imported.displayTitle}" from ${file.name}`);
		return true;
	}

	/** Downloads the current situation; it then counts as saved. */
	exportCurrent(): string {
		const situation = this.deps.editor.current();
		const filename = this.deps.files.export(situation);
		this.deps.editor.markSaved();
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

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
