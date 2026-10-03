import type { BoardElement } from "./elements/BoardElement";
import type { IdGenerator } from "./ids/IdGenerator";

/**
 * One step of a situation. Immutable: change methods return a new instance,
 * or `this` when nothing changes (e.g. an unknown element id).
 */
export class Frame {
	constructor(
		readonly id: string,
		/** Markdown source. */
		readonly description: string,
		readonly elements: readonly BoardElement[],
	) {}

	static createEmpty(ids: IdGenerator): Frame {
		return new Frame(ids.next(), "", []);
	}

	findElement(id: string): BoardElement | undefined {
		return this.elements.find((element) => element.id === id);
	}

	addElement(element: BoardElement): Frame {
		if (this.findElement(element.id)) {
			throw new Error(`Frame ${this.id} already contains an element with id ${element.id}`);
		}
		return new Frame(this.id, this.description, [...this.elements, element]);
	}

	removeElement(id: string): Frame {
		if (!this.findElement(id)) {
			return this;
		}
		return new Frame(
			this.id,
			this.description,
			this.elements.filter((element) => element.id !== id),
		);
	}

	updateElement(id: string, update: (element: BoardElement) => BoardElement): Frame {
		const existing = this.findElement(id);
		if (!existing) {
			return this;
		}
		const updated = update(existing);
		if (updated === existing) {
			return this;
		}
		if (updated.id !== id) {
			throw new Error(`Updating element ${id} must not change its id (got ${updated.id})`);
		}
		return new Frame(
			this.id,
			this.description,
			this.elements.map((element) => (element.id === id ? updated : element)),
		);
	}

	withDescription(description: string): Frame {
		return new Frame(this.id, description, this.elements);
	}

	/**
	 * A new frame (new id) with the same elements (same element ids) and the
	 * same description. Elements are immutable, so sharing them is safe.
	 */
	copy(ids: IdGenerator): Frame {
		return new Frame(ids.next(), this.description, this.elements);
	}
}
