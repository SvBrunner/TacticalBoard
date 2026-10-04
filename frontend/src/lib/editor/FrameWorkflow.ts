import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import type { Frame } from "$lib/model/Frame";
import type { Situation } from "$lib/model/Situation";

/** The editor operations the frame workflow uses; implemented by `SituationEditor`. */
export interface FrameEditing {
	current(): Situation;
	currentFrame(): Frame;
	selectFrame(frameId: string): void;
	addFrame(): string;
	deleteFrame(frameId: string): boolean;
	moveFrame(frameId: string, toIndex: number): void;
}

export interface FrameWorkflowLog {
	notify(message: string): void;
}

export interface FrameWorkflowDependencies {
	readonly editor: FrameEditing;
	/** Asks the user a yes/no question, e.g. through `ConfirmationPrompt`. */
	readonly confirm: (request: ConfirmationRequest) => Promise<boolean>;
	/**
	 * Runs right before another frame becomes active, e.g. to close the edit
	 * popover and clear the selection (element ids repeat across frames).
	 */
	readonly beforeFrameSwitch?: () => void;
	readonly log?: FrameWorkflowLog;
}

/** The question asked before a frame is deleted. */
export function deleteFrameRequest(frameNumber: number): ConfirmationRequest {
	return {
		title: (m) => m.frames.deleteQuestion,
		message: (m) => m.frames.deleteMessage(frameNumber),
		confirmLabel: (m) => m.common.delete,
		cancelLabel: (m) => m.common.cancel,
	};
}

/**
 * The frame use cases of the frame strip: switch, add, delete (after a
 * confirmation), reorder. Frame numbers in messages are 1-based positions.
 */
export class FrameWorkflow {
	constructor(private readonly deps: FrameWorkflowDependencies) {}

	/** Makes the frame active; selecting the already active frame changes nothing. */
	select(frameId: string): void {
		if (frameId === this.deps.editor.currentFrame().id) {
			return;
		}
		this.deps.beforeFrameSwitch?.();
		this.deps.editor.selectFrame(frameId);
		this.log(`Frame ${this.numberOf(frameId)}`);
	}

	/** Adds a copy of the active frame after it; the copy becomes active. */
	add(): void {
		this.deps.beforeFrameSwitch?.();
		const id = this.deps.editor.addFrame();
		this.log(`Added frame ${this.numberOf(id)}`);
	}

	/**
	 * Deletes the frame after the user confirmed it. The last frame can't be
	 * deleted and isn't asked about. Returns whether the frame was deleted.
	 */
	async delete(frameId: string): Promise<boolean> {
		const situation = this.deps.editor.current();
		const index = situation.indexOfFrame(frameId);
		if (index === -1 || situation.frames.length <= 1) {
			return false;
		}
		if (!(await this.deps.confirm(deleteFrameRequest(index + 1)))) {
			return false;
		}
		if (frameId === this.deps.editor.currentFrame().id) {
			this.deps.beforeFrameSwitch?.();
		}
		const deleted = this.deps.editor.deleteFrame(frameId);
		if (deleted) {
			this.log(`Deleted frame ${index + 1}`);
		}
		return deleted;
	}

	/** Moves the frame so that it ends up at `toIndex` (0-based, clamped). */
	move(frameId: string, toIndex: number): void {
		const from = this.deps.editor.current().indexOfFrame(frameId);
		this.deps.editor.moveFrame(frameId, toIndex);
		const to = this.deps.editor.current().indexOfFrame(frameId);
		if (from !== to) {
			this.log(`Moved frame ${from + 1} to position ${to + 1}`);
		}
	}

	private numberOf(frameId: string): number {
		return this.deps.editor.current().indexOfFrame(frameId) + 1;
	}

	private log(message: string): void {
		this.deps.log?.notify(message);
	}
}
