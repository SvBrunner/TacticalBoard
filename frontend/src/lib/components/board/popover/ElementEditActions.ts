import type { ElementType } from "$lib/model/elements/ElementType";

/** The edits the element popover offers; implemented by `SituationEditor`. */
export interface ElementEditActions {
	changeType(id: string, type: ElementType): void;
	changeColor(id: string, color: string): void;
	changeLabel(id: string, label: string): void;
	removeElement(id: string): void;
	/** Ends the current edit session (e.g. a text field lost focus): the next edit is a new undo step. */
	endGesture(): void;
}
