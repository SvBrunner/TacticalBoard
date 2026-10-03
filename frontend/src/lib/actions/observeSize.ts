import type { Action } from "svelte/action";

export interface Size {
	readonly width: number;
	readonly height: number;
}

export type SizeListener = (size: Size) => void;

/**
 * Svelte action reporting the element's content-box size (excluding
 * padding) whenever it changes, including once right after mounting.
 * The ResizeObserver is disconnected when the element is destroyed.
 */
export const observeSize: Action<HTMLElement, SizeListener> = (node, listener) => {
	let current = listener;
	const observer = new ResizeObserver((entries) => {
		const entry = entries[entries.length - 1];
		if (entry) {
			current({ width: entry.contentRect.width, height: entry.contentRect.height });
		}
	});
	observer.observe(node);

	return {
		update(next: SizeListener) {
			current = next;
		},
		destroy() {
			observer.disconnect();
		},
	};
};
