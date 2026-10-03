import type { ElementType } from "$lib/model/elements/ElementType";

/** The edits the element popover offers; implemented by `SituationEditor`. */
export interface ElementEditActions {
	/** Changes the type within the element's family (point types / arrow types). */
	changeType(id: string, type: ElementType): void;
	changeColor(id: string, color: string): void;
	changeLabel(id: string, label: string): void;
	/** Removes one bend of an arrow (a step of its own). */
	removeBend(id: string, bendIndex: number): void;
	/** Removes every bend of an arrow (a step of its own). */
	straightenArrow(id: string): void;
	removeElement(id: string): void;
	/** Ends the current edit session (e.g. a text field lost focus): the next edit is a new undo step. */
	endGesture(): void;
}
