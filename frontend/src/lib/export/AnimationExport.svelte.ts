import { BoardViewport } from "$lib/board/BoardViewport";
import type { FileDownloader } from "$lib/files/FileDownloader";
import { FileNameSlug } from "$lib/files/FileNameSlug";
import type { FileShare } from "$lib/files/FileShare";
import type { Situation } from "$lib/model/Situation";
import type { TimelineSettings } from "$lib/playback/PlaybackTimeline";
import { ExportResolution, type PixelSize } from "./ExportResolution";
import type { SlideshowExporter } from "./SlideshowExporter";

/** Where an animation export stands. */
export type AnimationExportPhase =
	| { readonly kind: "idle" }
	| { readonly kind: "rendering"; readonly done: number; readonly total: number }
	| { readonly kind: "ready"; readonly file: File }
	| { readonly kind: "failed"; readonly message: string };

/** What is exported: the situation as it is when the export starts, with the playback settings. */
export interface AnimationExportSource {
	readonly situation: Situation;
	readonly settings: TimelineSettings;
}

export interface AnimationExportLog {
	notify(message: string, level?: "info" | "warn" | "error"): void;
}

export interface AnimationExportDependencies {
	readonly exporter: Pick<SlideshowExporter, "export">;
	readonly downloader: FileDownloader;
	readonly share: FileShare;
	readonly log?: AnimationExportLog;
}

/** Used when the title has no characters usable in a file name (like `situation.json` for JSON). */
const FALLBACK_BASENAME = "situation";
const IDLE: AnimationExportPhase = { kind: "idle" };

/**
 * The "Animated GIF" export use case behind the export dialog: choose a
 * resolution, create the animation (with progress, cancellable), then
 * download it as `<slug of title>.gif` or hand it to the share sheet where
 * the device supports sharing files. Exporting an animation never counts
 * as saving the situation. Reactive state (Svelte runes).
 */
export class AnimationExport {
	phase = $state<AnimationExportPhase>(IDLE);
	resolution = $state<ExportResolution>(ExportResolution.DEFAULT);
	/** Set when sharing failed (the file stays ready). */
	shareError = $state<string | null>(null);

	private source = $state.raw<AnimationExportSource | null>(null);
	private running: AbortController | null = null;

	constructor(private readonly deps: AnimationExportDependencies) {}

	/**
	 * Starts over for the given situation and settings (when the dialog
	 * opens): back to idle with the default resolution; a running export is
	 * cancelled.
	 */
	begin(source: AnimationExportSource): void {
		this.abortRunning();
		this.source = source;
		this.phase = IDLE;
		this.resolution = ExportResolution.DEFAULT;
		this.shareError = null;
	}

	/** Cancels a running export and forgets the result (when the dialog closes). */
	close(): void {
		this.abortRunning();
		this.source = null;
		this.phase = IDLE;
		this.shareError = null;
	}

	get frameCount(): number {
		return this.source?.situation.frames.length ?? 0;
	}

	get frameDurationMs(): number | null {
		return this.source?.settings.frameDurationMs ?? null;
	}

	/** Pixel size of the animation at a resolution, for the current situation's field. */
	sizeAt(resolution: ExportResolution): PixelSize | null {
		const situation = this.source?.situation;
		return situation ? resolution.sizeFor(BoardViewport.forSituation(situation).contentSize) : null;
	}

	get isRendering(): boolean {
		return this.phase.kind === "rendering";
	}

	/** Whether the finished file can be handed to the share sheet on this device. */
	get canShare(): boolean {
		return this.phase.kind === "ready" && this.deps.share.canShare(this.phase.file);
	}

	/** Changes the resolution (not while rendering); a finished file is discarded. */
	chooseResolution(resolution: ExportResolution): void {
		if (this.isRendering || resolution === this.resolution) {
			return;
		}
		this.resolution = resolution;
		if (this.phase.kind !== "idle") {
			this.phase = IDLE;
		}
	}

	/** Creates the animation; resolves once it is ready, failed or cancelled. */
	async create(): Promise<void> {
		const source = this.source;
		if (!source || this.isRendering) {
			return;
		}
		const controller = new AbortController();
		this.running = controller;
		this.shareError = null;
		this.phase = { kind: "rendering", done: 0, total: source.situation.frames.length };
		const resolution = this.resolution;
		try {
			const result = await this.deps.exporter.export({
				situation: source.situation,
				settings: source.settings,
				resolution,
				signal: controller.signal,
				onProgress: (done, total) => {
					if (this.running === controller) {
						this.phase = { kind: "rendering", done, total };
					}
				},
			});
			if (this.running !== controller) {
				return;
			}
			const name = FileNameSlug.fileName(
				source.situation.title,
				result.fileExtension,
				`${FALLBACK_BASENAME}${result.fileExtension}`,
			);
			this.phase = { kind: "ready", file: new File([result.blob], name, { type: result.mimeType }) };
			this.log(`Created ${name}: ${result.frameCount} frame(s), ${result.width} × ${result.height} px`);
		} catch (error) {
			if (this.running !== controller) {
				return; // cancelled or started over; the newer state wins
			}
			const message = error instanceof Error ? error.message : String(error);
			this.phase = { kind: "failed", message };
			this.log(`Animation export failed: ${message}`, "error");
		} finally {
			if (this.running === controller) {
				this.running = null;
			}
		}
	}

	/** Stops a running export; back to idle. */
	cancel(): void {
		if (this.isRendering) {
			this.abortRunning();
			this.phase = IDLE;
			this.log("Animation export cancelled");
		}
	}

	/** Downloads the finished file. */
	download(): void {
		if (this.phase.kind !== "ready") {
			return;
		}
		const { file } = this.phase;
		this.deps.downloader.download(file.name, file);
		this.log(`Downloaded ${file.name}`);
	}

	/** Opens the share sheet with the finished file (call from a click). */
	async share(): Promise<void> {
		if (!this.canShare || this.phase.kind !== "ready") {
			return;
		}
		const { file } = this.phase;
		this.shareError = null;
		try {
			const outcome = await this.deps.share.share(file);
			this.log(outcome === "shared" ? `Shared ${file.name}` : "Sharing cancelled");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.shareError = message;
			this.log(`Sharing ${file.name} failed: ${message}`, "error");
		}
	}

	private abortRunning(): void {
		const running = this.running;
		this.running = null;
		running?.abort();
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
