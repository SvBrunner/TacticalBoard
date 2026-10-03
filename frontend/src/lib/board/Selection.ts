import { derived, get, writable, type Readable } from "svelte/store";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";

/**
 * The currently selected element of the active frame (at most one) and,
 * for an arrow, optionally one of its bends (the "active bend", which the
 * popover can remove). Selection is UI state, not part of the model, and
 * not undoable. When the selected element disappears (deleted, undone,
 * another situation loaded), the selection clears itself, so an undo can't
 * silently re-select it; likewise the active bend when its arrow loses it.
 */
export class Selection {
	private readonly id = writable<string | null>(null);
	private readonly bend = writable<number | null>(null);
	private readonly unsubscribe: () => void;

	readonly selectedId: Readable<string | null> = { subscribe: this.id.subscribe };
	/** Index of the active bend of the selected arrow, or `null`. */
	readonly selectedBend: Readable<number | null> = { subscribe: this.bend.subscribe };
	readonly selected: Readable<BoardElement | null>;

	constructor(private readonly elements: Readable<readonly BoardElement[]>) {
		this.selected = derived([this.id, elements], ([id, current]) =>
			id === null ? null : (current.find((element) => element.id === id) ?? null),
		);
		this.unsubscribe = elements.subscribe((current) => {
			const id = get(this.id);
			if (id === null) {
				return;
			}
			const element = current.find((candidate) => candidate.id === id);
			if (!element) {
				this.clear();
			} else if (!Selection.hasBend(element, get(this.bend))) {
				this.bend.set(null);
			}
		});
	}

	current(): string | null {
		return get(this.id);
	}

	currentBend(): number | null {
		return get(this.bend);
	}

	/** Selects an element of the active frame (no active bend); unknown ids are ignored. */
	select(id: string): void {
		if (get(this.elements).some((element) => element.id === id)) {
			this.id.set(id);
			this.bend.set(null);
		}
	}

	/** Selects an arrow of the active frame and makes one of its bends the active bend; anything else is ignored. */
	selectBend(id: string, bendIndex: number): void {
		const element = get(this.elements).find((candidate) => candidate.id === id);
		if (element && Selection.hasBend(element, bendIndex)) {
			this.id.set(id);
			this.bend.set(bendIndex);
		}
	}

	/** Keeps the element selected but makes no bend active. */
	clearBend(): void {
		this.bend.set(null);
	}

	clear(): void {
		this.id.set(null);
		this.bend.set(null);
	}

	private static hasBend(element: BoardElement, bendIndex: number | null): boolean {
		return bendIndex === null || (element instanceof ArrowElement && bendIndex >= 0 && bendIndex < element.bends.length);
	}

	/** Stops following the elements store. */
	destroy(): void {
		this.unsubscribe();
	}
}
