import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import Konva from "konva";
import type { Shape } from "konva/lib/Shape";
import BoardCanvas from "./BoardCanvas.svelte";
import { get } from "svelte/store";
import { BoardInteractionController } from "$lib/board/BoardInteractionController";
import { BoardViewport } from "$lib/board/BoardViewport";
import { PopoverState } from "$lib/board/PopoverState";
import { Selection } from "$lib/board/Selection";
import { ToolState } from "$lib/board/ToolState";
import { SituationEditor } from "$lib/editor/SituationEditor";
import { FixedClock } from "$lib/model/Clock";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { SequentialIdGenerator } from "$lib/model/ids/IdGenerator";
import { PointElement } from "$lib/model/elements/PointElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import type { Text as KonvaText } from "konva/lib/shapes/Text";
import type { ScreenRect } from "$lib/board/BoardViewport";
import { ELEMENT_NODE_NAME, LABEL_NODE_NAME, LABEL_STYLE } from "./Shapes";

const player = new PointElement("p1", 500, 250, "red", "Player");
const ball = new PointElement("b1", 1000, 500, "grey", "Ball");

function fakeController() {
	return {
		tapElement: vi.fn(),
		tapField: vi.fn(),
		contextMenu: vi.fn(),
		dragStart: vi.fn(),
		dragMove: vi.fn((point: { x: number; y: number }) => point),
		dragEnd: vi.fn(),
		relocatePopover: vi.fn(),
	};
}

function renderCanvas(overrides: Record<string, unknown> = {}) {
	const controller = fakeController();
	const result = render(BoardCanvas, {
		props: {
			elements: [player, ball] as readonly BoardElement[],
			selectedId: null as string | null,
			controller,
			viewport: new BoardViewport(),
			...overrides,
		},
	});
	return { ...result, controller };
}

async function resizeField(width: number, height: number) {
	FakeResizeObserver.resize(screen.getByRole("region", { name: "Field" }), width, height);
	await tick();
}

function stage(): Konva.Stage {
	return Konva.stages[Konva.stages.length - 1];
}

function elementShapes(): Shape[] {
	return stage().find(`.${ELEMENT_NODE_NAME}`) as Shape[];
}

function labelNodes(): KonvaText[] {
	return stage().find(`.${LABEL_NODE_NAME}`) as KonvaText[];
}

function pointerEvent(overrides: Record<string, unknown> = {}) {
	return { button: 0, shiftKey: false, pointerType: "touch", preventDefault: vi.fn(), ...overrides };
}

describe("BoardCanvas", () => {
	let restoreCanvas: () => void;

	beforeEach(() => {
		restoreCanvas = installFakeCanvasContext();
		FakeResizeObserver.reset();
		vi.stubGlobal("ResizeObserver", FakeResizeObserver);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		restoreCanvas();
	});

	it("renders a Field region", () => {
		renderCanvas();

		expect(screen.getByRole("region", { name: "Field" }).tagName).toBe("SECTION");
	});

	it("creates no stage until the field has a size", () => {
		const { container } = renderCanvas();

		expect(container.querySelector(".stage-container")).toBeNull();
	});

	it("sizes and scales the full field to fit the field area without rotating or offsetting it", async () => {
		const { container } = renderCanvas();

		await resizeField(400, 600);

		expect(stage().width()).toBe(400);
		expect(stage().height()).toBe(200);
		expect(stage().scaleX()).toBe(0.2);
		expect(stage().scaleY()).toBe(0.2);
		expect(stage().rotation()).toBe(0);
		expect(stage().position()).toEqual({ x: 0, y: 0 });
		const box = container.querySelector<HTMLElement>(".stage-container")!;
		expect(box.style.width).toBe("400px");
		expect(box.style.height).toBe("200px");
	});

	it("refits when the field area is resized", async () => {
		renderCanvas();
		await resizeField(400, 600);

		await resizeField(1000, 300);

		expect(stage().width()).toBe(600);
		expect(stage().height()).toBe(300);
		expect(stage().scaleX()).toBe(0.3);
	});

	it("renders one draggable shape per element at its scene position", async () => {
		renderCanvas();
		await resizeField(1000, 500);

		const shapes = elementShapes();
		expect(shapes.map((shape) => shape.id())).toEqual(["p1", "b1"]);
		expect(shapes[0].position()).toEqual({ x: 500, y: 250 });
		expect(shapes[0].fill()).toBe("red");
		expect(shapes[0].getAttr("elementType")).toBe("Player");
		expect(shapes.every((shape) => shape.draggable())).toBe(true);
	});

	it("follows element changes", async () => {
		const { rerender } = renderCanvas();
		await resizeField(1000, 500);

		await rerender({ elements: [player.withPosition(10, 20)] });

		const shapes = elementShapes();
		expect(shapes).toHaveLength(1);
		expect(shapes[0].position()).toEqual({ x: 10, y: 20 });
	});

	it("gives every element a solid hit circle of at least 44 CSS px", async () => {
		renderCanvas();
		await resizeField(400, 200); // scale 0.2

		for (const shape of elementShapes()) {
			expect(shape.hitFunc()).toBeTypeOf("function");
			const context = { beginPath: vi.fn(), arc: vi.fn(), closePath: vi.fn(), fillStrokeShape: vi.fn() };
			shape.hitFunc()(context as never, shape);
			const radius = context.arc.mock.calls[0][2];
			expect(radius * 0.2 * 2).toBeGreaterThanOrEqual(44 - 1e-9);
		}
	});

	it("highlights only the selected element, with a constant on-screen stroke width", async () => {
		renderCanvas({ selectedId: "b1" });
		await resizeField(1000, 500);

		const [unselected, selected] = elementShapes();
		expect(selected.strokeWidth()).toBeGreaterThan(0);
		expect(selected.stroke()).toBeTruthy();
		expect(selected.strokeScaleEnabled()).toBe(false);
		expect(unselected.strokeWidth()).toBe(0);
	});

	it("does not listen on the background layers", async () => {
		renderCanvas();
		await resizeField(1000, 500);

		const layers = stage().getLayers();
		const elementLayer = layers[layers.length - 1];
		expect(layers.slice(0, -1).every((layer) => !layer.listening())).toBe(true);
		expect(elementLayer.listening()).toBe(true);
	});

	describe("position labels", () => {
		const labeled = new PointElement("p2", 800, 400, "oklch(62% 0.16 230)", "Player", "LV");
		const darkLabeled = new PointElement("p3", 900, 400, "oklch(30% 0.05 260)", "Player", "10");
		const hiddenLabel = new PointElement("c1", 600, 600, "grey", "Circle", "C");

		it("draws a text only for players with a label", async () => {
			renderCanvas({ elements: [player, labeled, hiddenLabel, darkLabeled] });
			await resizeField(1000, 500);

			expect(labelNodes().map((node) => node.text())).toEqual(["LV", "10"]);
		});

		it("centers the text on the element", async () => {
			renderCanvas({ elements: [labeled] });
			await resizeField(1000, 500);

			const [text] = labelNodes();
			expect(text.position()).toEqual({ x: 800, y: 400 });
			expect(text.width()).toBe(LABEL_STYLE.box);
			expect(text.height()).toBe(LABEL_STYLE.box);
			expect(text.offsetX()).toBe(LABEL_STYLE.box / 2);
			expect(text.offsetY()).toBe(LABEL_STYLE.box / 2);
			expect(text.align()).toBe("center");
			expect(text.verticalAlign()).toBe("middle");
			expect(text.fontStyle()).toBe("bold");
			expect(text.fontSize()).toBe(LABEL_STYLE.fontSize);
		});

		it("uses a contrasting text color for the fill", async () => {
			renderCanvas({ elements: [labeled, darkLabeled] });
			await resizeField(1000, 500);

			expect(labelNodes().map((node) => node.fill())).toEqual(["black", "white"]);
		});

		it("does not intercept pointer events: taps and drags go to the element", async () => {
			renderCanvas({ elements: [labeled] });
			await resizeField(1000, 500);

			const [text] = labelNodes();
			expect(text.listening()).toBe(false);
			expect(text.isListening()).toBe(false);
			expect(text.draggable()).toBe(false);
			expect(elementShapes()[0].listening()).toBe(true);
		});

		it("is drawn above its own element (right after it in the layer)", async () => {
			renderCanvas({ elements: [labeled, player] });
			await resizeField(1000, 500);

			const [text] = labelNodes();
			const [shape] = elementShapes();
			expect(text.zIndex()).toBe(shape.zIndex() + 1);
		});

		it("stays upright on the full field", async () => {
			renderCanvas({ elements: [labeled] });
			await resizeField(1000, 500);

			expect(labelNodes()[0].rotation()).toBe(0);
			expect(labelNodes()[0].getAbsoluteRotation()).toBeCloseTo(0);
		});

		it("stays upright on the rotated half field", async () => {
			renderCanvas({ elements: [labeled.withPosition(1500, 400)], viewport: new BoardViewport(FieldDimensions.FLOORBALL, "half") });
			await resizeField(1000, 500);

			const [text] = labelNodes();
			expect(stage().rotation()).toBe(90);
			expect(text.rotation()).toBe(-90);
			expect(text.getAbsoluteRotation()).toBeCloseTo(0);
		});

		it("follows the element while it is dragged and settles on the model position after the drop", async () => {
			const { rerender } = renderCanvas({ elements: [labeled] });
			await resizeField(1000, 500);
			const [shape] = elementShapes();

			shape.fire("dragstart", {});
			shape.position({ x: 1200, y: 300 });
			shape.fire("dragmove", {});
			await tick();
			expect(labelNodes()[0].position()).toEqual({ x: 1200, y: 300 });

			shape.fire("dragend", {});
			await rerender({ elements: [labeled.withPosition(1200, 300)] });
			expect(labelNodes()[0].position()).toEqual({ x: 1200, y: 300 });
		});

		it("appears, changes and disappears with the label and the type", async () => {
			const { rerender } = renderCanvas({ elements: [player] });
			await resizeField(1000, 500);
			expect(labelNodes()).toHaveLength(0);

			await rerender({ elements: [player.withLabel("C")] });
			expect(labelNodes().map((node) => node.text())).toEqual(["C"]);

			await rerender({ elements: [player.withLabel("C").withType("Triangle")] });
			expect(labelNodes()).toHaveLength(0);

			await rerender({ elements: [player.withLabel("C").withType("Triangle").withType("Player")] });
			expect(labelNodes().map((node) => node.text())).toEqual(["C"]);
		});
	});

	describe("popover anchor on geometry changes", () => {
		function lastLocator(controller: ReturnType<typeof fakeController>): (id: string) => ScreenRect | null {
			return controller.relocatePopover.mock.calls.at(-1)![0];
		}

		it("asks the controller to re-anchor when the stage is first fitted and on every refit", async () => {
			const { controller } = renderCanvas();
			expect(controller.relocatePopover).not.toHaveBeenCalled();

			await resizeField(1000, 500);
			expect(controller.relocatePopover).toHaveBeenCalledTimes(1);

			await resizeField(400, 600);
			expect(controller.relocatePopover).toHaveBeenCalledTimes(2);
		});

		it("locates elements at their on-screen position for the new fit", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500); // scale 0.5
			expect(lastLocator(controller)("p1")).toEqual({ x: 250 - 10, y: 125 - 10, width: 20, height: 20 });

			await resizeField(400, 600); // scale 0.2
			expect(lastLocator(controller)("p1")).toEqual({ x: 100 - 4, y: 50 - 4, width: 8, height: 8 });
			expect(lastLocator(controller)("missing")).toBeNull();
		});

		it("locates on the rotated half field", async () => {
			const { controller } = renderCanvas({
				viewport: new BoardViewport(FieldDimensions.FLOORBALL, "half"),
				elements: [new PointElement("f1", 1800, 500, "red", "Player")],
			});
			await resizeField(1000, 500);

			expect(lastLocator(controller)("f1")).toEqual({ x: 240, y: 390, width: 20, height: 20 });
		});

		it("re-anchors on window resizes too (the stage can move without changing size)", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500);
			controller.relocatePopover.mockClear();

			window.dispatchEvent(new Event("resize"));
			await tick();

			expect(controller.relocatePopover).toHaveBeenCalledOnce();
		});

		it("moves an open popover with its element and leaves a closed one closed (integration)", async () => {
			const editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock());
			const id = editor.addElement(500, 250, "red", "Player");
			const selection = new Selection(editor.elements);
			const popover = new PopoverState();
			const controller = new BoardInteractionController({
				editor,
				selection,
				tools: new ToolState(),
				popover,
				bounds: new BoardViewport(),
				neutralColor: "grey",
			});
			const { rerender } = render(BoardCanvas, {
				props: { elements: get(editor.elements), selectedId: null, controller, viewport: new BoardViewport() },
			});
			await resizeField(1000, 500);
			elementShapes()[0].fire("pointerclick", { evt: pointerEvent() }, true);
			await rerender({ selectedId: id });
			expect(get(popover.anchor)).toEqual({ x: 240, y: 115, width: 20, height: 20 });

			await resizeField(400, 600);
			expect(popover.isOpen()).toBe(true);
			expect(get(popover.anchor)).toEqual({ x: 96, y: 46, width: 8, height: 8 });

			popover.close();
			await resizeField(1000, 500);
			expect(popover.isOpen()).toBe(false);
			selection.destroy();
		});
	});

	describe("gestures", () => {
		it("a tap on the empty field reports the scene point", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500); // scale 0.5

			stage().setPointersPositions({ clientX: 100, clientY: 60 } as unknown as PointerEvent);
			stage().fire("pointerclick", { evt: pointerEvent() });

			expect(controller.tapField).toHaveBeenCalledWith({ x: 200, y: 120 });
			expect(controller.tapElement).not.toHaveBeenCalled();
		});

		it("a tap on an element reports its id, on-screen anchor and Shift state", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500); // scale 0.5

			elementShapes()[0].fire("pointerclick", { evt: pointerEvent({ shiftKey: true }) }, true);

			expect(controller.tapElement).toHaveBeenCalledWith(
				"p1",
				{ x: 250 - 10, y: 125 - 10, width: 20, height: 20 },
				{ shiftKey: true },
			);
			expect(controller.tapField).not.toHaveBeenCalled();
		});

		it("ignores secondary-button clicks (they open the context menu)", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500);

			stage().fire("pointerclick", { evt: pointerEvent({ button: 2, pointerType: "mouse" }) });
			elementShapes()[0].fire("pointerclick", { evt: pointerEvent({ button: 2, pointerType: "mouse" }) }, true);

			expect(controller.tapField).not.toHaveBeenCalled();
			expect(controller.tapElement).not.toHaveBeenCalled();
		});

		it("a context menu on an element reports it and suppresses the browser menu", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500);
			const evt = pointerEvent();

			elementShapes()[1].fire("contextmenu", { evt }, true);

			expect(evt.preventDefault).toHaveBeenCalled();
			expect(controller.contextMenu).toHaveBeenCalledWith("b1", expect.objectContaining({ width: 12, height: 12 }));
		});

		it("a context menu on the empty field only suppresses the browser menu", async () => {
			const { controller } = renderCanvas();
			await resizeField(1000, 500);
			const evt = pointerEvent();

			stage().fire("contextmenu", { evt });

			expect(evt.preventDefault).toHaveBeenCalled();
			expect(controller.contextMenu).not.toHaveBeenCalled();
		});

		it("forwards drag start, clamped drag moves and drag end", async () => {
			const { controller } = renderCanvas();
			controller.dragMove.mockReturnValue({ x: 2000, y: 0 });
			await resizeField(1000, 500);
			const shape = elementShapes()[0];

			shape.fire("dragstart", {});
			shape.position({ x: 2300, y: -40 });
			shape.fire("dragmove", {});
			shape.fire("dragend", {});

			expect(controller.dragStart).toHaveBeenCalledWith("p1");
			expect(controller.dragMove).toHaveBeenCalledWith({ x: 2300, y: -40 });
			expect(shape.position()).toEqual({ x: 2000, y: 0 });
			expect(controller.dragEnd).toHaveBeenCalledWith("p1", { x: 2000, y: 0 });
		});
	});

	describe("half field", () => {
		const halfViewport = () => new BoardViewport(FieldDimensions.FLOORBALL, "half");
		// In the visible (right) half, and one hidden in the left half.
		const forward = new PointElement("f1", 1800, 500, "red", "Player");
		const hidden = new PointElement("h1", 300, 300, "blue", "Player");

		function renderHalf(overrides: Record<string, unknown> = {}) {
			return renderCanvas({ viewport: halfViewport(), elements: [forward, hidden], ...overrides });
		}

		it("rotates the stage by 90° and offsets it so the visible half fills it", async () => {
			const { container } = renderHalf();

			await resizeField(1000, 500); // the floorball half is square: 500 × 500, scale 0.5

			expect(stage().width()).toBe(500);
			expect(stage().height()).toBe(500);
			expect(stage().scaleX()).toBe(0.5);
			expect(stage().scaleY()).toBe(0.5);
			expect(stage().rotation()).toBe(90);
			expect(stage().position()).toEqual({ x: 500, y: -500 });
			const box = container.querySelector<HTMLElement>(".stage-container")!;
			expect(box.style.width).toBe("500px");
			expect(box.style.height).toBe("500px");
		});

		it("Konva's transform matches the viewport mapping: the half's goal end is at the bottom", async () => {
			renderHalf();
			await resizeField(1000, 500);
			const viewport = halfViewport();
			const fit = viewport.fit(1000, 500);

			const [visible] = elementShapes();

			const expected = viewport.sceneToStage({ x: 1800, y: 500 }, fit);
			const actual = visible.getAbsolutePosition();
			expect(actual.x).toBeCloseTo(expected.x);
			expect(actual.y).toBeCloseTo(expected.y);
			expect(actual.y).toBeGreaterThan(fit.height / 2);
		});

		it("keeps elements of the hidden half in the scene, outside the visible stage area", async () => {
			renderHalf();
			await resizeField(1000, 500);

			const shapes = elementShapes();
			expect(shapes.map((shape) => shape.id())).toEqual(["f1", "h1"]);
			const outside = shapes[1].getAbsolutePosition();
			expect(outside.y).toBeLessThan(0);
		});

		it("a tap reports the full-field scene point, same as Konva's own inverse transform", async () => {
			const { controller } = renderHalf();
			await resizeField(1000, 500);

			stage().setPointersPositions({ clientX: 100, clientY: 60 } as unknown as PointerEvent);
			stage().fire("pointerclick", { evt: pointerEvent() });

			expect(controller.tapField).toHaveBeenCalledWith({ x: 1120, y: 800 });
			const konva = stage().getRelativePointerPosition()!;
			expect(konva.x).toBeCloseTo(1120);
			expect(konva.y).toBeCloseTo(800);
		});

		it("anchors the popover at the element's rotated on-screen position", async () => {
			const { controller } = renderHalf();
			await resizeField(1000, 500);

			elementShapes()[0].fire("pointerclick", { evt: pointerEvent() }, true);

			// Scene (1800, 500) -> stage (250, 400); Player radius 20 -> 10 px.
			expect(controller.tapElement).toHaveBeenCalledWith(
				"f1",
				{ x: 240, y: 390, width: 20, height: 20 },
				{ shiftKey: false },
			);
		});

		it("drags in scene coordinates despite the rotation", async () => {
			const { controller } = renderHalf();
			controller.dragMove.mockReturnValue({ x: 2000, y: 400 });
			await resizeField(1000, 500);
			const shape = elementShapes()[0];

			shape.fire("dragstart", {});
			shape.position({ x: 2100, y: 400 });
			shape.fire("dragmove", {});
			shape.fire("dragend", {});

			expect(controller.dragMove).toHaveBeenCalledWith({ x: 2100, y: 400 });
			expect(controller.dragEnd).toHaveBeenCalledWith("f1", { x: 2000, y: 400 });
		});

		it("placing by tap stores full-field coordinates in the visible half (integration)", async () => {
			const editor = new SituationEditor(new SequentialIdGenerator(), new FixedClock());
			editor.createNew({ title: "Half", fieldType: "half" });
			const viewport = BoardViewport.forSituation(editor.current());
			const tools = new ToolState();
			tools.selectTool("Ball");
			const selection = new Selection(editor.elements);
			const controller = new BoardInteractionController({
				editor,
				selection,
				tools,
				popover: new PopoverState(),
				bounds: viewport,
				neutralColor: "grey",
			});
			render(BoardCanvas, { props: { elements: [], selectedId: null, controller, viewport } });
			await resizeField(1000, 500);

			// Near the bottom-left of the stage: bottom = goal end (scene x 2000),
			// left = scene y 1000.
			stage().setPointersPositions({ clientX: 50, clientY: 450 } as unknown as PointerEvent);
			stage().fire("pointerclick", { evt: pointerEvent() });

			const [placed] = get(editor.elements);
			expect(placed).toMatchObject({ type: "Ball", x: 1900, y: 900 });
			selection.destroy();
		});
	});
});
