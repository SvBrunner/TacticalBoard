import type { ElementType } from "$lib/model/elements/ElementType";

/** The edits the element popover offers; implemented by `SituationEditor`. */
export interface ElementEditActions {
	changeType(id: string, type: ElementType): void;
	changeColor(id: string, color: string): void;
	removeElement(id: string): void;
}
