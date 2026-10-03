import { readable, type Readable } from "svelte/store";

/**
 * A store that forwards the values of `source` but skips a value equal
 * (by `equals`) to the previously forwarded one. Svelte's own stores treat
 * every object as changed, so this keeps subscribers from seeing repeats.
 */
export function distinctUntilChanged<T>(source: Readable<T>, equals: (a: T, b: T) => boolean): Readable<T> {
	return readable<T>(undefined as T, (set) => {
		let hasValue = false;
		let last: T;
		return source.subscribe((value) => {
			if (hasValue && equals(last, value)) {
				return;
			}
			hasValue = true;
			last = value;
			set(value);
		});
	});
}
