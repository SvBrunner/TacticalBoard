import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import { AddElementCommand } from "$lib/commands/AddElementCommand";
import { ChangeElementColorCommand } from "$lib/commands/ChangeElementColorCommand";
import { ChangeElementTypeCommand } from "$lib/commands/ChangeElementTypeCommand";
import type { FrameCommand } from "$lib/commands/FrameCommand";
import { MoveElementCommand } from "$lib/commands/MoveElementCommand";
import { RemoveElementCommand } from "$lib/commands/RemoveElementCommand";
import type { CommandHistory } from "$lib/history/CommandHistory";
import { FrameHistories } from "$lib/history/FrameHistories";
import { sameHistoryStatus, type HistoryStatus } from "$lib/history/HistoryStatus";
import type { Clock } from "$lib/model/Clock";
import { SystemClock } from "$lib/model/Clock";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { ElementType } from "$lib/model/elements/ElementType";
import { PointElement } from "$lib/model/elements/PointElement";
import type { Frame } from "$lib/model/Frame";
import type { IdGenerator } from "$lib/model/ids/IdGenerator";
import { UuidIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";
import { distinctUntilChanged } from "$lib/stores/distinctUntilChanged";

interface EditorState {
	readonly situation: Situation;
	readonly activeFrameId: string;
}

/**
 * Application service holding the situation being edited and the active
 * frame. It is the UI's only entry point for changing the model: every edit
 * becomes a command executed through the active frame's undo/redo history
 * (one independent history per frame). Loading a situation is not undoable
 * and clears all histories.
 */
export class SituationEditor {
	private readonly state: Writable<EditorState>;
	private readonly histories = new FrameHistories();

	readonly situation: Readable<Situation>;
	readonly activeFrame: Readable<Frame>;
	readonly elements: Readable<readonly BoardElement[]>;
	/** Undo/redo status of the active frame's history. */
	readonly history: Readable<HistoryStatus>;

	constructor(
		private readonly ids: IdGenerator = new UuidIdGenerator(),
		private readonly clock: Clock = new SystemClock(),
		initial: Situation = Situation.create({ sport: "floorball", fieldType: "full" }, ids, clock),
	) {
		this.state = writable<EditorState>(SituationEditor.initialState(initial));
		this.situation = derived(this.state, (state) => state.situation);
		this.activeFrame = derived(this.state, (state) => SituationEditor.activeFrameOf(state));
		this.elements = derived(this.activeFrame, (frame) => frame.elements);
		// Re-subscribes on every state change (not only on a new frame id), so a
		// history replaced by `load` with the same frame id is picked up too.
		this.history = distinctUntilChanged(
			derived<Writable<EditorState>, HistoryStatus>(this.state, (state, set) =>
				this.histories.for(SituationEditor.activeFrameOf(state).id).status.subscribe(set),
			),
			sameHistoryStatus,
		);
	}

	current(): Situation {
		return get(this.state).situation;
	}

	/** Replaces the edited situation; the first frame becomes active. Not undoable: clears every history. */
	load(situation: Situation): void {
		this.histories.clear();
		this.state.set(SituationEditor.initialState(situation));
	}

	/** Makes another frame the active one. Not an undo step; ends the current edit session. */
	selectFrame(frameId: string): void {
		const state = get(this.state);
		if (!state.situation.findFrame(frameId)) {
			throw new Error(`Situation ${state.situation.id} has no frame with id ${frameId}`);
		}
		this.activeHistory().seal();
		this.state.set({ ...state, activeFrameId: frameId });
	}

	/** Adds a point element to the active frame and returns its id. */
	addElement(x: number, y: number, color: string, type: ElementType): string {
		const element = PointElement.create(this.ids, x, y, color, type);
		this.execute(new AddElementCommand(element));
		return element.id;
	}

	removeElement(id: string): void {
		const command = RemoveElementCommand.of(this.activeFrameNow(), id);
		if (command) {
			this.execute(command);
		}
	}

	/**
	 * Moves a point element. Consecutive moves of the same element merge into
	 * one undo step until `endGesture()` is called.
	 */
	moveElement(id: string, x: number, y: number): void {
		const element = this.findPointElement(id);
		if (element) {
			this.execute(MoveElementCommand.of(element, x, y));
		}
	}

	changeColor(id: string, color: string): void {
		const element = this.activeFrameNow().findElement(id);
		if (element) {
			this.execute(ChangeElementColorCommand.of(element, color));
		}
	}

	changeType(id: string, type: ElementType): void {
		const element = this.findPointElement(id);
		if (element) {
			this.execute(ChangeElementTypeCommand.of(element, type));
		}
	}

	/** Reverts the active frame's last step; returns its label, or `undefined` if there was nothing to undo. */
	undo(): string | undefined {
		const label = this.activeHistory().currentStatus().undoLabel;
		this.updateActiveFrame((frame, history) => history.undo(frame));
		return label;
	}

	/** Re-applies the active frame's last undone step; returns its label, or `undefined` if there was nothing to redo. */
	redo(): string | undefined {
		const label = this.activeHistory().currentStatus().redoLabel;
		this.updateActiveFrame((frame, history) => history.redo(frame));
		return label;
	}

	/** Ends the current edit session (a drag, a text field focus): the next edit starts a new undo step. */
	endGesture(): void {
		this.activeHistory().seal();
	}

	private execute(command: FrameCommand): void {
		this.updateActiveFrame((frame, history) => history.execute(command, frame));
	}

	/** The single mutation seam: changes the active frame and refreshes `updatedAt` if anything changed. */
	private updateActiveFrame(update: (frame: Frame, history: CommandHistory<Frame>) => Frame): void {
		const state = get(this.state);
		const frameId = SituationEditor.activeFrameOf(state).id;
		const history = this.histories.for(frameId);
		const changed = state.situation.updateFrame(frameId, (frame) => update(frame, history));
		if (changed === state.situation) {
			return;
		}
		this.state.set({ ...state, situation: changed.withUpdatedAt(this.clock.now().toISOString()) });
	}

	private activeHistory(): CommandHistory<Frame> {
		return this.histories.for(this.activeFrameNow().id);
	}

	private activeFrameNow(): Frame {
		return SituationEditor.activeFrameOf(get(this.state));
	}

	private findPointElement(id: string): PointElement | undefined {
		const element = this.activeFrameNow().findElement(id);
		return element instanceof PointElement ? element : undefined;
	}

	private static initialState(situation: Situation): EditorState {
		return { situation, activeFrameId: situation.frames[0].id };
	}

	private static activeFrameOf(state: EditorState): Frame {
		return state.situation.findFrame(state.activeFrameId) ?? state.situation.frames[0];
	}
}

export const situationEditor = new SituationEditor();
