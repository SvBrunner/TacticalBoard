import { vi } from "vitest";

/**
 * Stubs `HTMLCanvasElement.prototype.getContext` with a recording-free 2D
 * context, so Konva can render in jsdom without the native `canvas` package
 * (which isn't loadable on every machine). Every method is a no-op;
 * properties can be set and read back. Returns a restore function.
 */
export function installFakeCanvasContext(): () => void {
	const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
		return createFakeContext(this) as never;
	});
	return () => spy.mockRestore();
}

function createFakeContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const state: Record<PropertyKey, unknown> = {
		canvas,
		measureText: () => ({ width: 0 }),
		getImageData: (_x: number, _y: number, w: number, h: number) => ({
			width: w,
			height: h,
			data: new Uint8ClampedArray(Math.max(0, w * h * 4)),
		}),
		createLinearGradient: () => ({ addColorStop: () => {} }),
		createRadialGradient: () => ({ addColorStop: () => {} }),
		createPattern: () => ({}),
		getLineDash: () => [],
		getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
	};
	const noop = () => undefined;
	return new Proxy(state, {
		get(target, property) {
			return property in target ? target[property] : noop;
		},
		set(target, property, value) {
			target[property] = value;
			return true;
		},
	}) as unknown as CanvasRenderingContext2D;
}
