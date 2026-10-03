import { describe, it, expect, vi } from "vitest";
import * as gifenc from "gifenc";
import { parseGif } from "$lib/testing/GifStructure";
import type { RasterImage } from "./AnimationEncoder";
import { GifAnimationEncoder } from "./GifAnimationEncoder";

function solid(width: number, height: number, [r, g, b]: [number, number, number]): RasterImage {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < data.length; i += 4) {
		data.set([r, g, b, 255], i);
	}
	return { width, height, data };
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
	return new Uint8Array(await blob.arrayBuffer());
}

const encoder = () => new GifAnimationEncoder(gifenc);

describe("GifAnimationEncoder", () => {
	it("describes its output as image/gif with the .gif extension", () => {
		expect(encoder().mimeType).toBe("image/gif");
		expect(encoder().fileExtension).toBe(".gif");
	});

	it("produces a complete GIF89a of the pictures' size with one image per frame", async () => {
		const gif = encoder();
		gif.addFrame(solid(30, 20, [255, 255, 255]), 2000);
		gif.addFrame(solid(30, 20, [255, 0, 0]), 2000);
		gif.addFrame(solid(30, 20, [0, 0, 255]), 2000);

		const blob = gif.finish();
		const bytes = await bytesOf(blob);
		const parsed = parseGif(bytes);

		expect(blob.type).toBe("image/gif");
		expect(String.fromCharCode(...bytes.slice(0, 6))).toBe("GIF89a");
		expect(parsed.complete).toBe(true);
		expect([parsed.width, parsed.height]).toEqual([30, 20]);
		expect(parsed.images).toHaveLength(3);
		expect(parsed.images.map((image) => [image.left, image.top, image.width, image.height])).toEqual([
			[0, 0, 30, 20],
			[0, 0, 30, 20],
			[0, 0, 30, 20],
		]);
	});

	it("delays every image by its frame duration (in centiseconds)", async () => {
		const gif = encoder();
		gif.addFrame(solid(4, 4, [0, 0, 0]), 1000);
		gif.addFrame(solid(4, 4, [0, 0, 0]), 2000);
		gif.addFrame(solid(4, 4, [0, 0, 0]), 5000);

		const parsed = parseGif(await bytesOf(gif.finish()));

		expect(parsed.images.map((image) => image.delayCs)).toEqual([100, 200, 500]);
	});

	it("loops forever (NETSCAPE2.0 loop count 0)", async () => {
		const gif = encoder();
		gif.addFrame(solid(4, 4, [0, 0, 0]), 2000);
		gif.addFrame(solid(4, 4, [255, 255, 255]), 2000);

		expect(parseGif(await bytesOf(gif.finish())).loopCount).toBe(0);
	});

	it("gives every frame its own palette with that frame's colors", async () => {
		const gif = encoder();
		gif.addFrame(solid(8, 8, [255, 0, 0]), 2000);
		gif.addFrame(solid(8, 8, [0, 0, 255]), 2000);

		const parsed = parseGif(await bytesOf(gif.finish()));

		const red = (c: readonly number[]) => c[0] > 240 && c[1] < 10 && c[2] < 10;
		const blue = (c: readonly number[]) => c[0] < 10 && c[1] < 10 && c[2] > 240;
		expect(parsed.globalColors?.some(red)).toBe(true);
		expect(parsed.images[0].localColors).toBeNull();
		expect(parsed.images[1].localColors?.some(blue)).toBe(true);
		expect(parsed.images[1].localColors?.some(red)).toBe(false);
	});

	it("rejects pictures of another size than the first", () => {
		const gif = encoder();
		gif.addFrame(solid(4, 4, [0, 0, 0]), 2000);

		expect(() => gif.addFrame(solid(5, 4, [0, 0, 0]), 2000)).toThrow(/4 × 4/);
	});

	it("rejects pictures whose data doesn't match their size", () => {
		expect(() => encoder().addFrame({ width: 4, height: 4, data: new Uint8ClampedArray(10) }, 2000)).toThrow(/Invalid picture/);
	});

	it.each([0, -1, Number.NaN, 700_000])("rejects a frame duration of %s ms", (duration) => {
		expect(() => encoder().addFrame(solid(2, 2, [0, 0, 0]), duration)).toThrow(/duration/);
	});

	it("needs at least one frame", () => {
		expect(() => encoder().finish()).toThrow(/at least one frame/);
	});

	it("can't be used after finishing", () => {
		const gif = encoder();
		gif.addFrame(solid(2, 2, [0, 0, 0]), 2000);
		gif.finish();

		expect(() => gif.addFrame(solid(2, 2, [0, 0, 0]), 2000)).toThrow(/finished/);
		expect(() => gif.finish()).toThrow(/finished/);
	});

	it("create() loads gifenc through the given loader", async () => {
		const load = vi.fn(async () => gifenc);

		const created = await GifAnimationEncoder.create(load);

		expect(load).toHaveBeenCalledOnce();
		expect(created).toBeInstanceOf(GifAnimationEncoder);
	});

	it("create() loads the real gifenc by default", async () => {
		const created = await GifAnimationEncoder.create();
		created.addFrame(solid(2, 2, [0, 0, 0]), 2000);

		expect(parseGif(await bytesOf(created.finish())).images).toHaveLength(1);
	});
});
