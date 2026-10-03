import { derived, get, writable, type Readable, type Writable } from "svelte/store";
import type { Clock } from "$lib/model/Clock";
import { SystemClock } from "$lib/model/Clock";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { ElementType } from "$lib/model/elements/ElementType";
import { PointElement } from "$lib/model/elements/PointElement";
import type { Frame } from "$lib/model/Frame";
import type { IdGenerator } from "$lib/model/ids/IdGenerator";
import { UuidIdGenerator } from "$lib/model/ids/IdGenerator";
import { Situation } from "$lib/model/Situation";

interface EditorState {
	readonly situation: Situation;
	readonly activeFrameId: string;
}

/**
 * Application service holding the situation being edited and the active
 * frame. Every edit goes through `apply`, the single seam for later
 * undo/redo.
 */
export class SituationEditor {
	private readonly state: Writable<EditorState>;

	readonly situation: Readable<Situation>;
	readonly activeFrame: Readable<Frame>;
	readonly elements: Readable<readonly BoardElement[]>;

	constructor(
		private readonly ids: IdGenerator = new UuidIdGenerator(),
		private readonly clock: Clock = new SystemClock(),
		initial: Situation = Situation.create({ sport: "floorball", fieldType: "full" }, ids, clock),
	) {
		this.state = writable<EditorState>(SituationEditor.initialState(initial));
		this.situation = derived(this.state, (state) => state.situation);
		this.activeFrame = derived(this.state, (state) => SituationEditor.activeFrameOf(state));
		this.elements = derived(this.activeFrame, (frame) => frame.elements);
	}

	current(): Situation {
		return get(this.state).situation;
	}

	/** Replaces the edited situation; the first frame becomes active. */
	load(situation: Situation): void {
		this.state.set(SituationEditor.initialState(situation));
	}

	/** Adds a point element to the active frame and returns its id. */
	addElement(x: number, y: number, color: string, type: ElementType): string {
		const element = PointElement.create(this.ids, x, y, color, type);
		this.updateActiveFrame((frame) => frame.addElement(element));
		return element.id;
	}

	removeElement(id: string): void {
		this.updateActiveFrame((frame) => frame.removeElement(id));
	}

	moveElement(id: string, x: number, y: number): void {
		this.updatePointElement(id, (element) => element.withPosition(x, y));
	}

	changeColor(id: string, color: string): void {
		this.updateActiveFrame((frame) => frame.updateElement(id, (element) => element.withColor(color)));
	}

	changeType(id: string, type: ElementType): void {
		this.updatePointElement(id, (element) => element.withType(type));
	}

	private updatePointElement(id: string, update: (element: PointElement) => PointElement): void {
		this.updateActiveFrame((frame) =>
			frame.updateElement(id, (element) => (element instanceof PointElement ? update(element) : element)),
		);
	}

	private updateActiveFrame(update: (frame: Frame) => Frame): void {
		this.apply((situation, activeFrameId) => situation.updateFrame(activeFrameId, update));
	}

	/** The single mutation seam: applies a transform and refreshes `updatedAt` if anything changed. */
	private apply(transform: (situation: Situation, activeFrameId: string) => Situation): void {
		this.state.update((state) => {
			const changed = transform(state.situation, state.activeFrameId);
			if (changed === state.situation) {
				return state;
			}
			return { ...state, situation: changed.withUpdatedAt(this.clock.now().toISOString()) };
		});
	}

	private static initialState(situation: Situation): EditorState {
		return { situation, activeFrameId: situation.frames[0].id };
	}

	private static activeFrameOf(state: EditorState): Frame {
		return state.situation.findFrame(state.activeFrameId) ?? state.situation.frames[0];
	}
}

export const situationEditor = new SituationEditor();
