import { get, writable, type Readable } from "svelte/store";
import type { ScreenRect } from "./BoardViewport";

/** Whether the element edit popover is open, and the on-screen rect it is anchored to. */
export class PopoverState {
	private readonly store = writable<ScreenRect | null>(null);

	/** The anchor while the popover is open, `null` while it is closed. */
	readonly anchor: Readable<ScreenRect | null> = { subscribe: this.store.subscribe };

	isOpen(): boolean {
		return get(this.store) !== null;
	}

	open(anchor: ScreenRect): void {
		this.store.set(anchor);
	}

	close(): void {
		this.store.set(null);
	}
}
