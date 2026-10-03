import { describe, it, expect } from "vitest";
import { get, writable } from "svelte/store";
import { distinctUntilChanged } from "./distinctUntilChanged";

const sameX = (a: { x: number }, b: { x: number }) => a.x === b.x;

describe("distinctUntilChanged", () => {
	it("forwards the current value to a new subscriber", () => {
		const source = writable({ x: 1 });

		expect(get(distinctUntilChanged(source, sameX))).toEqual({ x: 1 });
	});

	it("skips values equal to the previously forwarded one", () => {
		const source = writable({ x: 1 });
		const seen: number[] = [];
		const unsubscribe = distinctUntilChanged(source, sameX).subscribe((value) => seen.push(value.x));

		source.set({ x: 1 });
		source.set({ x: 2 });
		source.set({ x: 2 });
		source.set({ x: 1 });
		unsubscribe();

		expect(seen).toEqual([1, 2, 1]);
	});

	it("unsubscribes from the source when the last subscriber leaves", () => {
		let subscribers = 0;
		const source = {
			subscribe(run: (value: { x: number }) => void) {
				subscribers += 1;
				run({ x: 1 });
				return () => {
					subscribers -= 1;
				};
			},
		};
		const unsubscribe = distinctUntilChanged(source, sameX).subscribe(() => {});

		expect(subscribers).toBe(1);
		unsubscribe();
		expect(subscribers).toBe(0);
	});
});
