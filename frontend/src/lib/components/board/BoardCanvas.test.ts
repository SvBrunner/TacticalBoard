import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { tick } from "svelte";
import Konva from "konva";
import type { Shape } from "konva/lib/Shape";
import BoardCanvas from "./BoardCanvas.svelte";
import { BoardViewport } from "$lib/board/BoardViewport";
import { PointElement } from "$lib/model/elements/PointElement";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import { FakeResizeObserver } from "$lib/testing/FakeResizeObserver";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import { ELEMENT_NODE_NAME } from "./Shapes";

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
	};
}

function renderCanvas(overrides: Record<string, unknown> = {}) {
	const controller = fakeController();
	const result = render(BoardCanvas, {
		props: {
			elements: [player, ball] as readonly BoardElement[],
			selectedId: null as string | null,
			controller,
			viewport: new BoardViewport(2000, 1000),
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

	it("sizes and scales the stage to fit the field area without rotating", async () => {
		const { container } = renderCanvas();

		await resizeField(400, 600);

		expect(stage().width()).toBe(400);
		expect(stage().height()).toBe(200);
		expect(stage().scaleX()).toBe(0.2);
		expect(stage().scaleY()).toBe(0.2);
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
});
