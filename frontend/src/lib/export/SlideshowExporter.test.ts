import { describe, it, expect, vi } from "vitest";
import type { BoardViewport } from "$lib/board/BoardViewport";
import { Frame } from "$lib/model/Frame";
import { PointElement } from "$lib/model/elements/PointElement";
import { Situation } from "$lib/model/Situation";
import type { FieldType } from "$lib/model/FieldType";
import { PlaybackSettings } from "$lib/playback/PlaybackSettings";
import type { AnimationEncoder, RasterImage } from "./AnimationEncoder";
import { ExportResolution, type PixelSize } from "./ExportResolution";
import type { FrameRenderer, RasterFrame } from "./FrameRasterizer.svelte";
import { SlideshowExporter, type SlideshowExportRequest } from "./SlideshowExporter";

function situation(frameCount = 3, fieldType: FieldType = "full"): Situation {
	return new Situation({
		id: "s1",
		title: "Breakout",
		description: "",
		sport: "floorball",
		fieldType,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: Array.from(
			{ length: frameCount },
			(_, i) => new Frame(`f${i + 1}`, "", [new PointElement(`p${i + 1}`, 100 * (i + 1), 100, "red", "Player")]),
		),
	});
}

class FakeRenderer implements FrameRenderer {
	readonly rendered: RasterFrame[] = [];
	disposed = 0;
	constructor(
		readonly viewport: BoardViewport,
		readonly size: PixelSize,
		private readonly onRender: (frame: RasterFrame) => void = () => {},
	) {}

	async render(frame: RasterFrame): Promise<RasterImage> {
		this.rendered.push(frame);
		this.onRender(frame);
		return { width: this.size.width, height: this.size.height, data: new Uint8ClampedArray(4) };
	}

	dispose(): void {
		this.disposed++;
	}
}

class FakeEncoder implements AnimationEncoder {
	readonly mimeType = "image/gif";
	readonly fileExtension = ".gif";
	readonly frames: { image: RasterImage; durationMs: number }[] = [];
	finished = false;

	addFrame(image: RasterImage, durationMs: number): void {
		this.frames.push({ image, durationMs });
	}

	finish(): Blob {
		this.finished = true;
		return new Blob(["GIF89a"], { type: this.mimeType });
	}
}

function setup(options: { onRender?: (frame: RasterFrame) => void; encoder?: AnimationEncoder } = {}) {
	const renderers: FakeRenderer[] = [];
	const encoder = options.encoder ?? new FakeEncoder();
	const encoderFactory = vi.fn(async () => encoder);
	const yieldToUi = vi.fn(async (): Promise<void> => undefined);
	const exporter = new SlideshowExporter({
		renderer: (viewport, size) => {
			const renderer = new FakeRenderer(viewport, size, options.onRender);
			renderers.push(renderer);
			return renderer;
		},
		encoder: encoderFactory,
		yieldToUi,
	});
	return { exporter, renderers, encoder, encoderFactory, yieldToUi };
}

function request(overrides: Partial<SlideshowExportRequest> = {}): SlideshowExportRequest {
	return {
		situation: situation(),
		settings: PlaybackSettings.DEFAULT.withFrameDuration(3000),
		resolution: ExportResolution.MEDIUM,
		...overrides,
	};
}

describe("SlideshowExporter", () => {
	it("renders all frames in order and encodes each for the playback frame duration", async () => {
		const { exporter, renderers, encoder } = setup();
		const s = situation(3);

		await exporter.export(request({ situation: s }));

		expect(renderers).toHaveLength(1);
		expect(renderers[0].rendered).toEqual(s.frames);
		expect((encoder as FakeEncoder).frames.map((frame) => frame.durationMs)).toEqual([3000, 3000, 3000]);
		expect((encoder as FakeEncoder).finished).toBe(true);
	});

	it("returns the encoded file with its type, size and frame count", async () => {
		const { exporter } = setup();

		const result = await exporter.export(request());

		expect(result.blob.type).toBe("image/gif");
		expect(result).toMatchObject({ mimeType: "image/gif", fileExtension: ".gif", width: 1200, height: 600, frameCount: 3 });
	});

	it("sizes a full field landscape and a half field portrait by the chosen resolution", async () => {
		const { exporter, renderers } = setup();

		await exporter.export(request({ situation: situation(2, "full"), resolution: ExportResolution.SMALL }));
		await exporter.export(request({ situation: situation(2, "half"), resolution: ExportResolution.LARGE }));

		expect(renderers.map((renderer) => renderer.size)).toEqual([
			{ width: 600, height: 300 },
			{ width: 1800, height: 1800 },
		]);
		expect(renderers.map((renderer) => renderer.viewport.fieldType)).toEqual(["full", "half"]);
		expect(renderers[1].viewport.rotation).toBe(90);
	});

	it("exports a single frame too", async () => {
		const { exporter, encoder } = setup();

		const result = await exporter.export(request({ situation: situation(1) }));

		expect(result.frameCount).toBe(1);
		expect((encoder as FakeEncoder).frames).toHaveLength(1);
	});

	it("reports progress from 0 to all frames, in order", async () => {
		const { exporter } = setup();
		const onProgress = vi.fn();

		await exporter.export(request({ onProgress }));

		expect(onProgress.mock.calls).toEqual([
			[0, 3],
			[1, 3],
			[2, 3],
			[3, 3],
		]);
	});

	it("yields to the UI after every frame", async () => {
		const order: string[] = [];
		const { exporter, yieldToUi } = setup({ onRender: (frame) => order.push(`render ${(frame as Frame).id}`) });
		yieldToUi.mockImplementation(async () => {
			order.push("yield");
		});

		await exporter.export(request());

		expect(order).toEqual(["render f1", "yield", "render f2", "yield", "render f3", "yield"]);
	});

	it("disposes the renderer when done", async () => {
		const { exporter, renderers } = setup();

		await exporter.export(request());

		expect(renderers[0].disposed).toBe(1);
	});

	it("stops early on abort, rejects with an AbortError and cleans up", async () => {
		const controller = new AbortController();
		const { exporter, renderers, encoder } = setup({
			onRender: (frame) => {
				if ((frame as Frame).id === "f2") controller.abort();
			},
		});

		const result = exporter.export(request({ signal: controller.signal, situation: situation(5) }));

		await expect(result).rejects.toMatchObject({ name: "AbortError" });
		expect(renderers[0].rendered.map((frame) => (frame as Frame).id)).toEqual(["f1", "f2"]);
		expect((encoder as FakeEncoder).frames).toHaveLength(1);
		expect((encoder as FakeEncoder).finished).toBe(false);
		expect(renderers[0].disposed).toBe(1);
	});

	it("stops when aborted while yielding to the UI", async () => {
		const controller = new AbortController();
		const { exporter, renderers, yieldToUi } = setup();
		yieldToUi.mockImplementationOnce(async () => controller.abort());

		await expect(exporter.export(request({ signal: controller.signal }))).rejects.toMatchObject({ name: "AbortError" });

		expect(renderers[0].rendered).toHaveLength(1);
		expect(renderers[0].disposed).toBe(1);
	});

	it("does nothing when already aborted", async () => {
		const controller = new AbortController();
		controller.abort();
		const { exporter, renderers, encoderFactory } = setup();

		await expect(exporter.export(request({ signal: controller.signal }))).rejects.toMatchObject({ name: "AbortError" });

		expect(encoderFactory).not.toHaveBeenCalled();
		expect(renderers).toHaveLength(0);
	});

	it("doesn't create the renderer when aborted while the encoder loads", async () => {
		const controller = new AbortController();
		const { exporter, renderers, encoderFactory, encoder } = setup();
		encoderFactory.mockImplementationOnce(async () => {
			controller.abort();
			return encoder;
		});

		await expect(exporter.export(request({ signal: controller.signal }))).rejects.toMatchObject({ name: "AbortError" });

		expect(renderers).toHaveLength(0);
	});

	it("passes encoder errors on and still disposes the renderer", async () => {
		const failing = new FakeEncoder();
		failing.addFrame = () => {
			throw new Error("out of memory");
		};
		const { exporter, renderers } = setup({ encoder: failing });

		await expect(exporter.export(request())).rejects.toThrow("out of memory");

		expect(renderers[0].disposed).toBe(1);
	});

	it("passes errors from finishing the encoding on", async () => {
		const failing = new FakeEncoder();
		failing.finish = () => {
			throw new Error("broken");
		};
		const { exporter } = setup({ encoder: failing });

		await expect(exporter.export(request())).rejects.toThrow("broken");
	});

	it("passes errors from loading the encoder on", async () => {
		const { exporter, encoderFactory, renderers } = setup();
		encoderFactory.mockRejectedValueOnce(new Error("chunk failed to load"));

		await expect(exporter.export(request())).rejects.toThrow("chunk failed to load");
		expect(renderers).toHaveLength(0);
	});

	it("passes rendering errors on and disposes the renderer", async () => {
		const { exporter, renderers } = setup({
			onRender: () => {
				throw new Error("no canvas");
			},
		});

		await expect(exporter.export(request())).rejects.toThrow("no canvas");
		expect(renderers[0].disposed).toBe(1);
	});

	it("by default yields with a macrotask", async () => {
		vi.useFakeTimers();
		try {
			const exporter = new SlideshowExporter({
				renderer: (viewport, size) => new FakeRenderer(viewport, size),
				encoder: async () => new FakeEncoder(),
			});
			let done = false;
			const result = exporter.export(request({ situation: situation(1) })).then(() => (done = true));

			await vi.advanceTimersByTimeAsync(0);
			await result;

			expect(done).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});
});
