import { describe, it, expect, vi } from "vitest";
import type { FileDownloader } from "$lib/files/FileDownloader";
import { Frame } from "$lib/model/Frame";
import { Situation } from "$lib/model/Situation";
import type { FieldType } from "$lib/model/FieldType";
import { AnimationExport, type AnimationExportSource } from "./AnimationExport.svelte";
import { ExportResolution } from "./ExportResolution";
import { ControlledExporter, FakeShare } from "$lib/testing/exportFakes";

function situation(title = "Breakout 2-1", fieldType: FieldType = "full", frames = 3): Situation {
	return new Situation({
		id: "s1",
		title,
		description: "",
		sport: "floorball",
		fieldType,
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		frames: Array.from({ length: frames }, (_, i) => new Frame(`f${i + 1}`, "", [])),
	});
}

function source(overrides: Partial<AnimationExportSource> = {}): AnimationExportSource {
	return { situation: situation(), settings: { frameDurationMs: 2000 }, ...overrides };
}

function setup() {
	const exporter = new ControlledExporter();
	const downloads: { filename: string; content: Blob }[] = [];
	const downloader: FileDownloader = { download: (filename, content) => downloads.push({ filename, content }) };
	const share = new FakeShare();
	const log = { notify: vi.fn() };
	const flow = new AnimationExport({ exporter, downloader, share, log });
	return { flow, exporter, downloads, share, log };
}

const flushPromises = async () => {
	for (let i = 0; i < 5; i++) await Promise.resolve();
};

async function ready(setupResult = setup(), from = source()) {
	setupResult.flow.begin(from);
	const created = setupResult.flow.create();
	setupResult.exporter.finish();
	await created;
	return setupResult;
}

describe("AnimationExport", () => {
	it("starts idle at the default (medium) resolution", () => {
		const { flow } = setup();

		flow.begin(source());

		expect(flow.phase).toEqual({ kind: "idle" });
		expect(flow.resolution).toBe(ExportResolution.MEDIUM);
	});

	it("tells the frame count and the playback frame duration of the source", () => {
		const { flow } = setup();

		flow.begin(source({ situation: situation("x", "full", 4), settings: { frameDurationMs: 5000 } }));

		expect(flow.frameCount).toBe(4);
		expect(flow.frameDurationMs).toBe(5000);
	});

	it("knows the picture size of each resolution for the situation's field", () => {
		const { flow } = setup();
		expect(flow.sizeAt(ExportResolution.SMALL)).toBeNull();

		flow.begin(source({ situation: situation("x", "half") }));

		expect(flow.sizeAt(ExportResolution.SMALL)).toEqual({ width: 600, height: 600 });
	});

	it("exports the source's situation and settings at the chosen resolution", () => {
		const { flow, exporter } = setup();
		const from = source();
		flow.begin(from);
		flow.chooseResolution(ExportResolution.LARGE);

		void flow.create();

		expect(exporter.requests).toHaveLength(1);
		expect(exporter.requests[0]).toMatchObject({
			situation: from.situation,
			settings: from.settings,
			resolution: ExportResolution.LARGE,
		});
	});

	it("shows progress while rendering", () => {
		const { flow, exporter } = setup();
		flow.begin(source());

		void flow.create();
		expect(flow.phase).toEqual({ kind: "rendering", done: 0, total: 3 });
		exporter.requests[0].onProgress?.(2, 3);

		expect(flow.phase).toEqual({ kind: "rendering", done: 2, total: 3 });
		expect(flow.isRendering).toBe(true);
	});

	it("ignores a second create while rendering", () => {
		const { flow, exporter } = setup();
		flow.begin(source());

		void flow.create();
		void flow.create();

		expect(exporter.requests).toHaveLength(1);
	});

	it("does nothing before begin", async () => {
		const { flow, exporter } = setup();

		await flow.create();

		expect(exporter.requests).toHaveLength(0);
	});

	it("is ready with a GIF file named after the title's slug", async () => {
		const { flow } = await ready();

		expect(flow.phase.kind).toBe("ready");
		const file = (flow.phase as { file: File }).file;
		expect(file.name).toBe("breakout-2-1.gif");
		expect(file.type).toBe("image/gif");
	});

	it("falls back to situation.gif when the title has no usable characters", async () => {
		const { flow } = await ready(setup(), source({ situation: situation("???") }));

		expect((flow.phase as { file: File }).file.name).toBe("situation.gif");
	});

	it("downloads the file with its name and mime type", async () => {
		const { flow, downloads } = await ready();

		flow.download();

		expect(downloads).toHaveLength(1);
		expect(downloads[0].filename).toBe("breakout-2-1.gif");
		expect(downloads[0].content.type).toBe("image/gif");
		expect(flow.phase.kind).toBe("ready"); // can still be shared or downloaded again
	});

	it("doesn't download before the file is ready", () => {
		const { flow, downloads } = setup();
		flow.begin(source());

		flow.download();

		expect(downloads).toEqual([]);
	});

	it("cancel aborts the export and goes back to idle", async () => {
		const { flow, exporter, log } = setup();
		flow.begin(source());
		const created = flow.create();

		flow.cancel();
		await created;

		expect(exporter.requests[0].signal?.aborted).toBe(true);
		expect(flow.phase).toEqual({ kind: "idle" });
		expect(log.notify).toHaveBeenCalledWith("Animation export cancelled", "info");
	});

	it("ignores progress and results of a cancelled export", async () => {
		const { flow, exporter } = setup();
		flow.begin(source());
		void flow.create();
		const first = exporter.requests[0];
		flow.cancel();

		first.onProgress?.(1, 3);
		await flushPromises();

		expect(flow.phase).toEqual({ kind: "idle" });
	});

	it("a cancelled export finishing late doesn't override a new one", async () => {
		const { flow, exporter } = setup();
		flow.begin(source());
		void flow.create();
		flow.cancel();
		void flow.create();

		exporter.finish(0);
		await flushPromises();

		expect(flow.phase).toEqual({ kind: "rendering", done: 0, total: 3 });
	});

	it("reports a failure with its message", async () => {
		const { flow, exporter, log } = setup();
		flow.begin(source());
		const created = flow.create();

		exporter.fail(new Error("out of memory"));
		await created;

		expect(flow.phase).toEqual({ kind: "failed", message: "out of memory" });
		expect(log.notify).toHaveBeenCalledWith("Animation export failed: out of memory", "error");
	});

	it("can try again after a failure", async () => {
		const { flow, exporter } = setup();
		flow.begin(source());
		const created = flow.create();
		exporter.fail(new Error("boom"));
		await created;

		void flow.create();

		expect(exporter.requests).toHaveLength(2);
		expect(flow.phase.kind).toBe("rendering");
	});

	it("choosing another resolution discards a finished file; not possible while rendering", async () => {
		const { flow } = await ready();

		flow.chooseResolution(ExportResolution.SMALL);
		expect(flow.phase).toEqual({ kind: "idle" });
		expect(flow.resolution).toBe(ExportResolution.SMALL);

		void flow.create();
		flow.chooseResolution(ExportResolution.LARGE);
		expect(flow.resolution).toBe(ExportResolution.SMALL);
	});

	it("begin starts over: idle, default resolution, running export aborted", () => {
		const { flow, exporter } = setup();
		flow.begin(source());
		flow.chooseResolution(ExportResolution.LARGE);
		void flow.create();

		flow.begin(source());

		expect(exporter.requests[0].signal?.aborted).toBe(true);
		expect(flow.phase).toEqual({ kind: "idle" });
		expect(flow.resolution).toBe(ExportResolution.DEFAULT);
	});

	it("close aborts a running export and forgets the source", () => {
		const { flow, exporter } = setup();
		flow.begin(source());
		void flow.create();

		flow.close();

		expect(exporter.requests[0].signal?.aborted).toBe(true);
		expect(flow.phase).toEqual({ kind: "idle" });
		expect(flow.frameCount).toBe(0);
	});

	describe("share", () => {
		it("is offered only for a ready file on a device that can share it", async () => {
			const s = setup();
			s.flow.begin(source());
			expect(s.flow.canShare).toBe(false);

			await ready(s);
			expect(s.flow.canShare).toBe(true);

			s.share.supported = false;
			expect(s.flow.canShare).toBe(false);
		});

		it("hands the file to the share sheet", async () => {
			const { flow, share, log } = await ready();

			await flow.share();

			expect(share.shared.map((file) => file.name)).toEqual(["breakout-2-1.gif"]);
			expect(log.notify).toHaveBeenCalledWith("Shared breakout-2-1.gif", "info");
			expect(flow.shareError).toBeNull();
		});

		it("closing the share sheet is not an error", async () => {
			const s = setup();
			s.share.outcome = "cancelled";
			const { flow, log } = await ready(s);

			await flow.share();

			expect(flow.shareError).toBeNull();
			expect(log.notify).toHaveBeenCalledWith("Sharing cancelled", "info");
		});

		it("reports a failed share and keeps the file ready", async () => {
			const s = setup();
			s.share.outcome = new Error("Not allowed");
			const { flow } = await ready(s);

			await flow.share();

			expect(flow.shareError).toBe("Not allowed");
			expect(flow.phase.kind).toBe("ready");
		});

		it("doesn't share where sharing isn't supported", async () => {
			const s = setup();
			s.share.supported = false;
			const { flow, share } = await ready(s);

			await flow.share();

			expect(share.shared).toEqual([]);
		});
	});
});
