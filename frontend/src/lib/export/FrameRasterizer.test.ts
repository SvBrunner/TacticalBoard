import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Konva from "konva";
import type { Shape } from "konva/lib/Shape";
import { BoardViewport } from "$lib/board/BoardViewport";
import { ARROW_HANDLE_NODE_NAME, ARROW_NODE_NAME, ELEMENT_NODE_NAME, LABEL_NODE_NAME } from "$lib/components/board/Shapes";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import { PointElement } from "$lib/model/elements/PointElement";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import { theme } from "$lib/theme";
import { FrameRasterizer } from "./FrameRasterizer.svelte";

const forward = new PointElement("f1", 1800, 500, "red", "Player");
const hidden = new PointElement("h1", 300, 300, "blue", "Player");
const pass = new ArrowElement("a1", "Pass", "black", ArrowGeometry.straight({ x: 1200, y: 200 }, { x: 1700, y: 600 }));

const fullViewport = () => new BoardViewport(FieldDimensions.FLOORBALL, "full");
const halfViewport = () => new BoardViewport(FieldDimensions.FLOORBALL, "half");

function exportStage(): Konva.Stage {
	return Konva.stages[Konva.stages.length - 1];
}

function hosts(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>("[data-export-scene]")];
}

describe("FrameRasterizer", () => {
	let restoreCanvas: () => void;
	const created: FrameRasterizer[] = [];

	function rasterizer(viewport = fullViewport(), size = { width: 1200, height: 600 }) {
		const instance = new FrameRasterizer(viewport, size);
		created.push(instance);
		return instance;
	}

	beforeEach(() => {
		restoreCanvas = installFakeCanvasContext();
	});

	afterEach(() => {
		created.splice(0).forEach((instance) => instance.dispose());
		restoreCanvas();
		vi.restoreAllMocks();
		theme.set("light");
	});

	it("mounts the scene into a hidden, inert container outside the viewport", async () => {
		await rasterizer().render({ elements: [] });

		const [host] = hosts();
		expect(host.getAttribute("aria-hidden")).toBe("true");
		expect(host.hasAttribute("inert")).toBe(true);
		expect(host.style.position).toBe("fixed");
		expect(parseInt(host.style.left, 10)).toBeLessThan(-10000);
		expect(host.querySelector("canvas")).not.toBeNull();
	});

	it("renders the full field landscape at exactly the export size", async () => {
		const image = await rasterizer(fullViewport(), { width: 1200, height: 600 }).render({ elements: [] });

		expect([image.width, image.height]).toEqual([1200, 600]);
		expect(image.data).toHaveLength(1200 * 600 * 4);
		const stage = exportStage();
		expect([stage.width(), stage.height(), stage.rotation()]).toEqual([1200, 600, 0]);
		expect(stage.scaleX()).toBeCloseTo(0.6);
	});

	it("renders the half field portrait (rotated, goal at the bottom) at exactly the export size", async () => {
		const image = await rasterizer(halfViewport(), { width: 600, height: 600 }).render({ elements: [forward] });

		expect([image.width, image.height]).toEqual([600, 600]);
		const stage = exportStage();
		expect([stage.width(), stage.height(), stage.rotation()]).toEqual([600, 600, 90]);
		const position = stage.findOne(`#${forward.id}`)!.getAbsolutePosition();
		expect(position.y).toBeGreaterThan(300); // near the goal end, in the lower half
	});

	it("keeps elements of the hidden half out of the picture", async () => {
		await rasterizer(halfViewport(), { width: 600, height: 600 }).render({ elements: [forward, hidden] });

		const outside = exportStage().findOne(`#${hidden.id}`)!.getAbsolutePosition();
		const inside = outside.x >= 0 && outside.x <= 600 && outside.y >= 0 && outside.y <= 600;
		expect(inside).toBe(false);
	});

	it("draws the given frame's elements when the stage is rendered", async () => {
		const seen: string[][] = [];
		const toCanvas = Konva.Stage.prototype.toCanvas;
		vi.spyOn(Konva.Stage.prototype, "toCanvas").mockImplementation(function (this: Konva.Stage, config) {
			seen.push(this.find(`.${ELEMENT_NODE_NAME}, .${ARROW_NODE_NAME}`).map((node) => node.id()));
			return toCanvas.call(this, config);
		});
		const instance = rasterizer();

		await instance.render({ elements: [forward, pass] });
		await instance.render({ elements: [hidden] });

		expect(seen).toEqual([["a1", "f1"], ["h1"]]);
	});

	it("renders at 1 pixel per CSS px", async () => {
		const spy = vi.spyOn(Konva.Stage.prototype, "toCanvas");

		await rasterizer().render({ elements: [] });

		expect(spy).toHaveBeenCalledWith({ pixelRatio: 1 });
	});

	it("draws elements as on the board: positions, colors, labels; nothing selected, draggable or listening", async () => {
		const labelled = new PointElement("p1", 500, 250, "red", "Player", "C");
		await rasterizer().render({ elements: [labelled, pass] });

		const stage = exportStage();
		const shape = stage.findOne(`#p1`) as Shape;
		expect(shape.position()).toEqual({ x: 500, y: 250 });
		expect(shape.fill()).toBe("red");
		expect(shape.strokeWidth()).toBe(0);
		expect(shape.draggable()).toBe(false);
		expect(shape.getLayer()!.listening()).toBe(false);
		expect(stage.find(`.${LABEL_NODE_NAME}`).map((node) => (node as Konva.Text).text())).toEqual(["C"]);
		expect(stage.find(`.${ARROW_HANDLE_NODE_NAME}`)).toHaveLength(0);
	});

	it("always uses the light field look, also in the dark theme", async () => {
		theme.set("dark");

		await rasterizer().render({ elements: [] });

		const surface = exportStage().findOne("Rect") as Konva.Rect;
		expect(surface.fill()).toBe("white");
	});

	it("puts the picture on an opaque white ground", async () => {
		const fills: string[] = [];
		const spy = vi.mocked(HTMLCanvasElement.prototype.getContext);
		const fake = spy.getMockImplementation()! as unknown as (this: HTMLCanvasElement, id: string) => CanvasRenderingContext2D;
		spy.mockImplementation(function (this: HTMLCanvasElement, id: string) {
			const context = fake.call(this, id);
			const fillRect = context.fillRect.bind(context);
			context.fillRect = (x, y, w, h) => {
				fills.push(`${String(context.fillStyle)} ${x},${y},${w},${h}`);
				fillRect(x, y, w, h);
			};
			return context as never;
		});

		await rasterizer(fullViewport(), { width: 600, height: 300 }).render({ elements: [] });

		expect(fills).toContain("white 0,0,600,300");
	});

	it("dispose removes the off-screen container and destroys the stage; it is idempotent", async () => {
		const instance = rasterizer();
		await instance.render({ elements: [forward] });
		const stage = exportStage();

		instance.dispose();
		instance.dispose();

		expect(hosts()).toHaveLength(0);
		expect(Konva.stages).not.toContain(stage);
	});

	it("can't render after dispose", async () => {
		const instance = rasterizer();
		instance.dispose();

		await expect(instance.render({ elements: [] })).rejects.toThrow(/disposed/);
	});

	it.each([
		[{ width: 0, height: 10 }],
		[{ width: 10.5, height: 10 }],
	])("rejects a size that isn't whole positive pixels: %o", (size) => {
		expect(() => new FrameRasterizer(fullViewport(), size)).toThrow(/whole positive pixels/);
		expect(hosts()).toHaveLength(0);
	});
});
