import { mount, tick, unmount } from "svelte";
import type { BoardViewport, StageFit } from "$lib/board/BoardViewport";
import BoardScene from "$lib/components/board/BoardScene.svelte";
import { FIELD_SURFACE_COLOR } from "$lib/components/board/Shapes";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import type { RasterImage } from "./AnimationEncoder";
import type { PixelSize } from "./ExportResolution";

/** What the rasterizer needs to know about a frame. */
export interface RasterFrame {
	readonly elements: readonly BoardElement[];
}

/** Turns frames into pictures of a fixed size. */
export interface FrameRenderer {
	readonly size: PixelSize;
	render(frame: RasterFrame): Promise<RasterImage>;
	/** Frees everything the renderer created. Idempotent. */
	dispose(): void;
}

/** Creates a renderer for one export. */
export type FrameRendererFactory = (viewport: BoardViewport, size: PixelSize) => FrameRenderer;

/**
 * Renders frames with the real board drawing (`BoardScene`), off screen:
 * the scene is mounted into a hidden container outside the viewport, laid
 * out by the viewport for exactly `size` pixels (full field landscape;
 * half field rotated with its goal at the bottom, the other half cropped,
 * so its elements are not visible). Always the light field look; nothing
 * is selected or interactive. One frame at a time: set the frame, let
 * Svelte update the scene, render the stage.
 */
export class FrameRasterizer implements FrameRenderer {
	private readonly host: HTMLElement;
	private readonly scene: { toCanvas(): HTMLCanvasElement };
	private readonly fit: StageFit;
	private elements = $state.raw<readonly BoardElement[]>([]);
	private disposed = false;

	constructor(
		viewport: BoardViewport,
		readonly size: PixelSize,
		private readonly document: Document = globalThis.document,
	) {
		if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width <= 0 || size.height <= 0) {
			throw new Error(`Export size must be whole positive pixels (got ${size.width} × ${size.height})`);
		}
		// The fit for exactly this size (the size already has the visible rect's aspect ratio).
		this.fit = { ...viewport.fit(size.width, size.height), width: size.width, height: size.height };
		this.host = this.createHost();
		const rasterizer = this;
		this.scene = mount(BoardScene, {
			target: this.host,
			props: {
				get elements() {
					return rasterizer.elements;
				},
				viewport,
				fit: this.fit,
			},
		});
	}

	async render(frame: RasterFrame): Promise<RasterImage> {
		if (this.disposed) {
			throw new Error("The rasterizer has been disposed");
		}
		this.elements = frame.elements;
		await tick();
		return this.pixelsOf(this.scene.toCanvas());
	}

	dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		unmount(this.scene);
		this.host.remove();
	}

	/** Container outside the visible page, ignored by assistive technology and input. */
	private createHost(): HTMLElement {
		const host = this.document.createElement("div");
		host.setAttribute("aria-hidden", "true");
		host.setAttribute("inert", "");
		host.dataset.exportScene = "";
		Object.assign(host.style, {
			position: "fixed",
			left: "-100000px",
			top: "0",
			width: `${this.size.width}px`,
			height: `${this.size.height}px`,
			overflow: "hidden",
			pointerEvents: "none",
		});
		this.document.body.appendChild(host);
		return host;
	}

	/** The picture on an opaque field-colored ground (GIF frames have no transparency). */
	private pixelsOf(scene: HTMLCanvasElement): RasterImage {
		const { width, height } = this.size;
		const canvas = this.document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d", { willReadFrequently: true });
		if (!context) {
			throw new Error("Canvas 2D is not available");
		}
		context.fillStyle = FIELD_SURFACE_COLOR;
		context.fillRect(0, 0, width, height);
		context.drawImage(scene, 0, 0, width, height);
		const pixels = context.getImageData(0, 0, width, height);
		// Free the canvases' memory right away (Safari keeps it otherwise).
		for (const used of [scene, canvas]) {
			used.width = 0;
			used.height = 0;
		}
		return { width, height, data: pixels.data };
	}
}
