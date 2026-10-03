import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import { BoardViewport } from "$lib/board/BoardViewport";
import { PointElement } from "$lib/model/elements/PointElement";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { Frame } from "$lib/model/Frame";
import FrameThumbnail from "./FrameThumbnail.svelte";
import { ArrowElement } from "$lib/model/elements/ArrowElement";
import { ArrowGeometry } from "$lib/model/elements/ArrowGeometry";

const fullViewport = new BoardViewport(FieldDimensions.FLOORBALL, "full");
const halfViewport = new BoardViewport(FieldDimensions.FLOORBALL, "half");

const frame = new Frame("f", "", [
	new PointElement("p", 1900, 500, "red", "Player"),
	new PointElement("b", 1050, 500, "black", "Ball"),
	new PointElement("r", 1500, 300, "grey", "Rectangle"),
	new PointElement("t", 1500, 600, "grey", "Triangle"),
	new PointElement("c", 1200, 800, "grey", "Circle"),
]);

function renderThumbnail(props: { frame?: Frame; viewport?: BoardViewport; height?: number } = {}) {
	const result = render(FrameThumbnail, { props: { frame, viewport: fullViewport, ...props } });
	const svg = result.container.querySelector("svg")!;
	const mark = (id: string) => svg.querySelector(`[data-element-id="${id}"]`)!;
	return { ...result, svg, mark };
}

describe("FrameThumbnail", () => {
	it("is a decorative SVG", () => {
		const { svg } = renderThumbnail();

		expect(svg).toHaveAttribute("aria-hidden", "true");
		expect(svg).toHaveAttribute("focusable", "false");
	});

	it("draws the field", () => {
		const { svg } = renderThumbnail();

		expect(svg.querySelector(".rink")).not.toBeNull();
		expect(svg.querySelectorAll(".field .line").length).toBeGreaterThanOrEqual(5);
	});

	it("draws every element in z-order with its color and type", () => {
		const { svg, mark } = renderThumbnail();

		const drawn = Array.from(svg.querySelectorAll("[data-element-id]"));
		expect(drawn.map((node) => node.getAttribute("data-element-id"))).toEqual(["p", "b", "r", "t", "c"]);
		expect(mark("p").tagName).toBe("circle");
		expect(mark("p")).toHaveAttribute("fill", "red");
		expect(mark("r").tagName).toBe("rect");
		expect(mark("t").tagName).toBe("polygon");
		expect(mark("c")).toHaveAttribute("fill", "none");
		expect(mark("c")).toHaveAttribute("stroke", "grey");
	});

	it("draws nothing but the field for an empty frame", () => {
		const { svg } = renderThumbnail({ frame: new Frame("e", "", []) });

		expect(svg.querySelectorAll("[data-element-id]")).toHaveLength(0);
	});

	describe("full field", () => {
		it("is landscape and keeps scene positions", () => {
			const { svg, mark } = renderThumbnail({ height: 40 });

			expect(svg).toHaveAttribute("viewBox", "0 0 2000 1000");
			expect(svg).toHaveAttribute("width", "80");
			expect(svg).toHaveAttribute("height", "40");
			expect(svg).toHaveAttribute("data-field-type", "full");
			expect(mark("p")).toHaveAttribute("cx", "1900");
			expect(mark("p")).toHaveAttribute("cy", "500");
		});
	});

	describe("half field", () => {
		it("shows the visible half in portrait, rotated like the board", () => {
			const { svg } = renderThumbnail({ viewport: halfViewport, height: 40 });

			expect(svg).toHaveAttribute("viewBox", "0 0 1000 1000");
			expect(svg).toHaveAttribute("width", "40");
			expect(svg).toHaveAttribute("data-field-type", "half");
			expect(svg.querySelector(".field")).toHaveAttribute("transform", "translate(1000 -1000) rotate(90)");
		});

		it("puts elements near the goal at the bottom and near the center line at the top", () => {
			const { mark } = renderThumbnail({ viewport: halfViewport });

			expect(Number(mark("p").getAttribute("cy"))).toBeCloseTo(900);
			expect(Number(mark("p").getAttribute("cx"))).toBeCloseTo(500);
			expect(Number(mark("b").getAttribute("cy"))).toBeCloseTo(50);
		});
	});

	it("updates when the frame changes", async () => {
		const { rerender, mark, svg } = renderThumbnail();

		await rerender({ frame: frame.updateElement("p", (e) => (e as PointElement).withPosition(100, 100)) });

		expect(mark("p")).toHaveAttribute("cx", "100");
		await rerender({ frame: frame.removeElement("p") });
		expect(svg.querySelector('[data-element-id="p"]')).toBeNull();
	});

	describe("arrows", () => {
		const shot = new ArrowElement("s", "Shot", "blue", ArrowGeometry.straight({ x: 1200, y: 500 }, { x: 1800, y: 500 }));
		const pass = new ArrowElement("a", "Pass", "black", new ArrowGeometry({ x: 1100, y: 300 }, { x: 1700, y: 300 }, [{ x: 1400, y: 100 }]));
		const withArrows = new Frame("f", "", [new PointElement("p", 1900, 500, "red", "Player"), shot, pass]);

		it("draws every arrow below the point elements with its line and head in its color", () => {
			const { svg } = renderThumbnail({ frame: withArrows });

			const arrows = Array.from(svg.querySelectorAll(".arrows [data-element-id]"));
			expect(arrows.map((node) => node.getAttribute("data-element-id"))).toEqual(["s", "a"]);
			expect(svg.querySelector(".arrows")!.compareDocumentPosition(svg.querySelector(".elements")!)).toBe(
				Node.DOCUMENT_POSITION_FOLLOWING,
			);
			const line = arrows[0].querySelector("path")!;
			expect(line).toHaveAttribute("stroke", "blue");
			expect(line).toHaveAttribute("fill", "none");
			expect(arrows[0].querySelector("polygon")).toHaveAttribute("fill", "blue");
		});

		it("dashes passes and draws shots thicker", () => {
			const { svg } = renderThumbnail({ frame: withArrows });
			const line = (id: string) => svg.querySelector(`[data-element-id="${id}"] path`)!;

			expect(line("a")).toHaveAttribute("stroke-dasharray");
			expect(line("s")).not.toHaveAttribute("stroke-dasharray");
			expect(Number(line("s").getAttribute("stroke-width"))).toBeGreaterThan(Number(line("a").getAttribute("stroke-width")));
		});

		it("updates when an arrow changes", async () => {
			const { rerender, svg } = renderThumbnail({ frame: withArrows });

			await rerender({ frame: withArrows.updateElement("s", (element) => (element as ArrowElement).withColor("green")) });
			expect(svg.querySelector('[data-element-id="s"] path')).toHaveAttribute("stroke", "green");

			await rerender({ frame: withArrows.removeElement("s") });
			expect(svg.querySelector('[data-element-id="s"]')).toBeNull();
		});
	});
});
