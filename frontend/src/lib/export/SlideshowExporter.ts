import { BoardViewport } from "$lib/board/BoardViewport";
import type { Situation } from "$lib/model/Situation";
import { PlaybackTimeline, type TimelineSettings } from "$lib/playback/PlaybackTimeline";
import type { AnimationEncoderFactory } from "./AnimationEncoder";
import type { ExportResolution } from "./ExportResolution";
import type { FrameRendererFactory } from "./FrameRasterizer.svelte";

/** Lets the browser breathe (paint, handle input) between two frames. */
export type YieldToUi = () => Promise<void>;

export interface SlideshowExportDependencies {
	readonly renderer: FrameRendererFactory;
	readonly encoder: AnimationEncoderFactory;
	readonly yieldToUi?: YieldToUi;
}

export interface SlideshowExportRequest {
	readonly situation: Situation;
	/** The playback settings: every frame is shown for their frame duration. */
	readonly settings: TimelineSettings;
	readonly resolution: ExportResolution;
	/** Reports progress: `done` of `total` frames rendered (first `0`, last `total`). */
	readonly onProgress?: (done: number, total: number) => void;
	/** Cancels the export; it then rejects with an `AbortError`. */
	readonly signal?: AbortSignal;
}

/** The finished animation. */
export interface SlideshowExportResult {
	readonly blob: Blob;
	readonly mimeType: string;
	readonly fileExtension: string;
	readonly width: number;
	readonly height: number;
	readonly frameCount: number;
}

const nextMacrotask: YieldToUi = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Exports a situation's slideshow as an animation: all frames in order,
 * each shown as long as the slideshow shows it (`PlaybackTimeline`, the
 * same timing as the in-editor playback), drawn like the board at the
 * chosen resolution. Renders one frame at a time and yields to the UI in
 * between, so progress can be shown and Cancel stays responsive. The
 * renderer is always disposed, also on errors and cancellation.
 */
export class SlideshowExporter {
	private readonly yieldToUi: YieldToUi;

	constructor(private readonly deps: SlideshowExportDependencies) {
		this.yieldToUi = deps.yieldToUi ?? nextMacrotask;
	}

	async export(request: SlideshowExportRequest): Promise<SlideshowExportResult> {
		const { situation, signal } = request;
		const timeline = PlaybackTimeline.of(situation.frames, request.settings);
		const total = timeline.frameCount;
		if (total === 0) {
			throw new Error("The situation has no frames to export");
		}
		signal?.throwIfAborted();
		const viewport = BoardViewport.forSituation(situation);
		const size = request.resolution.sizeFor(viewport.contentSize);
		const encoder = await this.deps.encoder();
		signal?.throwIfAborted();
		const renderer = this.deps.renderer(viewport, size);
		try {
			request.onProgress?.(0, total);
			for (const entry of timeline.entries) {
				const frame = situation.frames[entry.index];
				const image = await renderer.render(frame);
				signal?.throwIfAborted();
				encoder.addFrame(image, entry.durationMs);
				request.onProgress?.(entry.index + 1, total);
				await this.yieldToUi();
				signal?.throwIfAborted();
			}
		} finally {
			renderer.dispose();
		}
		return {
			blob: encoder.finish(),
			mimeType: encoder.mimeType,
			fileExtension: encoder.fileExtension,
			width: size.width,
			height: size.height,
			frameCount: total,
		};
	}
}
