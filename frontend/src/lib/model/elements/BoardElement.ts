import type { ElementType } from "./ElementType";

/**
 * An item on a frame. Immutable: change methods return a new instance.
 * The id is the element's identity and stays the same across frames.
 */
export abstract class BoardElement {
	protected constructor(
		readonly id: string,
		readonly color: string,
	) {}

	abstract readonly type: ElementType;

	abstract withColor(color: string): BoardElement;
}
