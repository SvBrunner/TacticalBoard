/**
 * Test double for ResizeObserver (jsdom has none). Install it with
 * `vi.stubGlobal("ResizeObserver", FakeResizeObserver)` and trigger size
 * changes with `FakeResizeObserver.resize(element, width, height)`.
 */
export class FakeResizeObserver {
	static readonly instances: FakeResizeObserver[] = [];

	readonly observed = new Set<Element>();
	disconnected = false;

	constructor(private readonly callback: ResizeObserverCallback) {
		FakeResizeObserver.instances.push(this);
	}

	observe(target: Element): void {
		this.observed.add(target);
	}

	unobserve(target: Element): void {
		this.observed.delete(target);
	}

	disconnect(): void {
		this.disconnected = true;
		this.observed.clear();
	}

	/** Reports a new content-box size for `target` to every observer watching it. */
	static resize(target: Element, width: number, height: number): void {
		for (const observer of FakeResizeObserver.instances) {
			if (observer.observed.has(target)) {
				const entry = { target, contentRect: { width, height } } as unknown as ResizeObserverEntry;
				observer.callback([entry], observer as unknown as ResizeObserver);
			}
		}
	}

	static reset(): void {
		FakeResizeObserver.instances.length = 0;
	}
}
