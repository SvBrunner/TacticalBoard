import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import Konva from "konva";
import type { Shape } from "konva/lib/Shape";
import type { Text as KonvaText } from "konva/lib/shapes/Text";
import { BoardViewport } from "$lib/board/BoardViewport";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";
import type { BoardElement } from "$lib/model/elements/BoardElement";
import { PointElement } from "$lib/model/elements/PointElement";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { installFakeCanvasContext } from "$lib/testing/fakeCanvasContext";
import BoardScene from "./BoardScene.svelte";
import type { SceneInteraction } from "./SceneInteraction";
import { ARROW_NODE_NAME, ELEMENT_NODE_NAME, LABEL_NODE_NAME } from "./Shapes";

const player = new PointElement("p1", 500, 250, "red", "Player", "C");
const ball = new PointElement("b1", 1000, 500, "grey", "Ball");
const pass = new ArrowElement("a1", "Pass", "black", ArrowGeometry.straight({ x: 100, y: 100 }, { x: 600, y: 300 }));

const fullViewport = () => new BoardViewport(FieldDimensions.FLOORBALL, "full");

function stage(): Konva.Stage {
	return Konva.stages[Konva.stages.length - 1];
}

function renderScene(overrides: Record<string, unknown> = {}) {
	const viewport = (overrides.viewport as BoardViewport | undefined) ?? fullViewport();
	return render(BoardScene, {
		props: {
			elements: [pass, player, ball] as readonly BoardElement[],
			viewport,
			fit: viewport.fit(1000, 500),
			...overrides,
		},
	});
}

function interaction(overrides: Partial<SceneInteraction> = {}): SceneInteraction {
	return {
		listening: true,
		draggable: true,
		selectedId: null,
		arrowHitWidth: 40,
		hitRadius: vi.fn(() => 50),
		arrowGeometry: vi.fn((arrow: ArrowElement) => arrow.geometry),
		pointDragStart: vi.fn(),
		pointDragMove: vi.fn((position) => position),
		pointDragEnd: vi.fn(),
		arrowDragStart: vi.fn(),
		arrowDragMove: vi.fn((_arrow, delta) => delta),
		arrowDragEnd: vi.fn(),
		...overrides,
	};
}

describe("BoardScene", () => {
	let restoreCanvas: () => void;

	beforeEach(() => {
		restoreCanvas = installFakeCanvasContext();
	});

	afterEach(() => {
		restoreCanvas();
	});

	it("lays the stage out by the given fit", () => {
		const viewport = new BoardViewport(FieldDimensions.FLOORBALL, "half");
		renderScene({ viewport, fit: viewport.fit(1000, 500) });

		expect([stage().width(), stage().height(), stage().scaleX(), stage().rotation()]).toEqual([500, 500, 0.5, 90]);
		expect(stage().position()).toEqual({ x: 500, y: -500 });
	});

	it("draws the field on a white surface (the light look)", () => {
		renderScene();

		const surface = stage().getLayers()[0].findOne("Rect") as Konva.Rect;
		expect(surface.fill()).toBe("white");
		expect([surface.width(), surface.height()]).toEqual([2000, 1000]);
		expect(stage().getLayers().length).toBeGreaterThanOrEqual(3);
	});

	it("draws arrows below point elements, each at its scene position", () => {
		renderScene();

		const arrows = stage().findOne(".arrows") as Konva.Group;
		const points = stage().findOne(".points") as Konva.Group;
		expect(arrows.zIndex()).toBeLessThan(points.zIndex());
		expect(arrows.find(`.${ARROW_NODE_NAME}`).map((node) => node.id())).toEqual(["a1"]);
		const shapes = points.find(`.${ELEMENT_NODE_NAME}`) as Shape[];
		expect(shapes.map((shape) => shape.id())).toEqual(["p1", "b1"]);
		expect(shapes[0].position()).toEqual({ x: 500, y: 250 });
		expect(shapes[0].fill()).toBe("red");
	});

	it("draws player labels upright against the stage rotation", () => {
		const viewport = new BoardViewport(FieldDimensions.FLOORBALL, "half");
		renderScene({ viewport, fit: viewport.fit(1000, 500) });

		const labels = stage().find(`.${LABEL_NODE_NAME}`) as KonvaText[];
		expect(labels.map((label) => label.text())).toEqual(["C"]);
		expect(labels[0].rotation()).toBe(-90);
	});

	describe("without interaction (a picture only)", () => {
		it("nothing listens, is draggable or selected", () => {
			renderScene();

			const shapes = stage().find(`.${ELEMENT_NODE_NAME}`) as Shape[];
			expect(shapes.every((shape) => !shape.draggable() && shape.strokeWidth() === 0)).toBe(true);
			expect(shapes[0].getLayer()!.listening()).toBe(false);
			expect(stage().findOne(`.${ARROW_NODE_NAME}`)!.draggable()).toBe(false);
		});

		it("toCanvas renders the stage at 1 pixel per CSS px", async () => {
			const { component } = renderScene();
			await tick();
			const spy = vi.spyOn(stage(), "toCanvas");

			const canvas = component.toCanvas();

			expect(spy).toHaveBeenCalledWith({ pixelRatio: 1 });
			expect(canvas).toBeInstanceOf(HTMLCanvasElement);
			expect([canvas.width, canvas.height]).toEqual([1000, 500]);
		});
	});

	describe("with interaction", () => {
		it("listens, makes elements draggable and highlights the selected one", () => {
			renderScene({ interaction: interaction({ selectedId: "b1" }) });

			const [unselected, selected] = stage().find(`.${ELEMENT_NODE_NAME}`) as Shape[];
			expect(selected.strokeWidth()).toBeGreaterThan(0);
			expect(unselected.strokeWidth()).toBe(0);
			expect(selected.draggable()).toBe(true);
			expect(selected.getLayer()!.listening()).toBe(true);
		});

		it("uses its hit radius and arrow geometry", () => {
			const moved = ArrowGeometry.straight({ x: 0, y: 0 }, { x: 50, y: 50 });
			const scene = interaction({ arrowGeometry: vi.fn(() => moved) });
			renderScene({ interaction: scene });
			stage().draw(); // the arrow's shape is read when it is drawn

			expect(scene.hitRadius).toHaveBeenCalledWith("Player");
			expect(scene.arrowGeometry).toHaveBeenCalledWith(pass);
		});

		it("reports point drags", () => {
			const scene = interaction({ pointDragMove: vi.fn(() => ({ x: 1, y: 2 })) });
			renderScene({ interaction: scene });
			const shape = stage().findOne("#p1")!;

			shape.fire("dragstart", {});
			shape.position({ x: 600, y: 300 });
			shape.fire("dragmove", {});
			shape.fire("dragend", {});

			expect(scene.pointDragStart).toHaveBeenCalledWith("p1");
			expect(scene.pointDragMove).toHaveBeenCalledWith({ x: 600, y: 300 });
			expect(scene.pointDragEnd).toHaveBeenCalledWith("p1", { x: 1, y: 2 });
		});

		it("reports arrow drags with the arrow", () => {
			const scene = interaction();
			renderScene({ interaction: scene });
			const arrow = stage().findOne(`.${ARROW_NODE_NAME}`)!;

			arrow.fire("dragstart", {});
			arrow.position({ x: 10, y: 20 });
			arrow.fire("dragmove", {});
			arrow.fire("dragend", {});

			expect(scene.arrowDragStart).toHaveBeenCalledWith(pass);
			expect(scene.arrowDragMove).toHaveBeenCalledWith(pass, { x: 10, y: 20 });
			expect(scene.arrowDragEnd).toHaveBeenCalledWith(pass, { x: 10, y: 20 });
		});

		it("follows a change of interaction (e.g. to read-only)", async () => {
			const { rerender } = renderScene({ interaction: interaction() });

			await rerender({ interaction: interaction({ listening: false, draggable: false }) });

			const shape = stage().findOne("#p1")!;
			expect(shape.draggable()).toBe(false);
			expect(shape.getLayer()!.listening()).toBe(false);
		});
	});

	it("forwards stage pointer events", () => {
		const onpointerclick = vi.fn();
		renderScene({ stageEvents: { onpointerclick } });

		stage().fire("pointerclick", { evt: {} });

		expect(onpointerclick).toHaveBeenCalledOnce();
	});

	it("renders the overlay on top of the elements", () => {
		const overlay = createRawSnippet(() => ({ render: () => "<span></span>" }));
		renderScene({ overlay });

		const overlayGroup = stage().findOne(".overlay") as Konva.Group;
		expect(overlayGroup.zIndex()).toBeGreaterThan((stage().findOne(".points") as Konva.Group).zIndex());
	});
});
