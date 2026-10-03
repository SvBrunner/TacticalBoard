import { derived, get, writable, type Readable } from "svelte/store";
import type { BoardElement } from "$lib/model/elements/BoardElement";

/**
 * The currently selected element of the active frame (at most one).
 * Selection is UI state, not part of the model, and not undoable. When the
 * selected element disappears (deleted, undone, another situation loaded),
 * the selection clears itself, so an undo can't silently re-select it.
 */
export class Selection {
	private readonly id = writable<string | null>(null);
	private readonly unsubscribe: () => void;

	readonly selectedId: Readable<string | null> = { subscribe: this.id.subscribe };
	readonly selected: Readable<BoardElement | null>;

	constructor(private readonly elements: Readable<readonly BoardElement[]>) {
		this.selected = derived([this.id, elements], ([id, current]) =>
			id === null ? null : (current.find((element) => element.id === id) ?? null),
		);
		this.unsubscribe = elements.subscribe((current) => {
			const id = get(this.id);
			if (id !== null && !current.some((element) => element.id === id)) {
				this.id.set(null);
			}
		});
	}

	current(): string | null {
		return get(this.id);
	}

	/** Selects an element of the active frame; unknown ids are ignored. */
	select(id: string): void {
		if (get(this.elements).some((element) => element.id === id)) {
			this.id.set(id);
		}
	}

	clear(): void {
		this.id.set(null);
	}

	/** Stops following the elements store. */
	destroy(): void {
		this.unsubscribe();
	}
}
