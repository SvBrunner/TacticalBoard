import { describe, it, expect } from "vitest";
import { BoardViewport } from "$lib/board/BoardViewport";
import { PointElement } from "$lib/model/elements/PointElement";
import { FieldDimensions } from "$lib/model/FieldDimensions";
import { Frame } from "$lib/model/Frame";
import { FrameThumbnailGeometry } from "./FrameThumbnailGeometry";

const full = new FrameThumbnailGeometry(new BoardViewport(FieldDimensions.FLOORBALL, "full"));
const half = new FrameThumbnailGeometry(new BoardViewport(FieldDimensions.FLOORBALL, "half"));

describe("FrameThumbnailGeometry", () => {
	describe("full field", () => {
		it("is landscape and unrotated", () => {
			expect(full.viewBox).toBe("0 0 2000 1000");
			expect([full.width, full.height]).toEqual([2000, 1000]);
			expect(full.fieldTransform).toBe("translate(0 0) rotate(0)");
		});

		it("places elements at their scene position", () => {
			const frame = new Frame("f", "", [new PointElement("p", 300, 700, "red", "Player")]);

			expect(full.marks(frame)).toEqual([
				{ id: "p", type: "Player", color: "red", x: 300, y: 700, radius: 20 * FrameThumbnailGeometry.ELEMENT_ENLARGEMENT },
			]);
		});
	});

	describe("half field", () => {
		it("shows the half in portrait, rotated by 90°", () => {
			const portrait = new FrameThumbnailGeometry(new BoardViewport(new FieldDimensions(2000, 800), "half"));

			expect(portrait.viewBox).toBe("0 0 800 1000");
			expect(portrait.fieldTransform).toBe("translate(800 -1000) rotate(90)");
		});

		it("puts the half's goal end at the bottom and the center line at the top", () => {
			const frame = new Frame("f", "", [
				new PointElement("nearGoal", 1900, 500, "red", "Player"),
				new PointElement("nearCenter", 1050, 500, "red", "Player"),
			]);

			const [nearGoal, nearCenter] = half.marks(frame);

			expect(nearGoal.y).toBeCloseTo(900);
			expect(nearCenter.y).toBeCloseTo(50);
			expect(nearGoal.x).toBeCloseTo(500);
		});

		it("maps the top side of the field to the right edge (clockwise rotation)", () => {
			const [mark] = half.marks(new Frame("f", "", [new PointElement("p", 1500, 100, "red", "Player")]));

			expect(mark.x).toBeCloseTo(900);
			expect(mark.y).toBeCloseTo(500);
		});

		it("keeps elements of the hidden half (they fall outside the viewBox)", () => {
			const [mark] = half.marks(new Frame("f", "", [new PointElement("p", 200, 500, "red", "Player")]));

			expect(mark.y).toBeLessThan(0);
		});
	});

	it("keeps the z-order and enlarges every element type by its visual radius", () => {
		const frame = new Frame("f", "", [
			new PointElement("ball", 0, 0, "black", "Ball"),
			new PointElement("ring", 0, 0, "grey", "Circle"),
			new PointElement("box", 0, 0, "grey", "Rectangle"),
			new PointElement("tri", 0, 0, "grey", "Triangle"),
		]);

		const marks = full.marks(frame);

		const k = FrameThumbnailGeometry.ELEMENT_ENLARGEMENT;
		expect(marks.map((mark) => [mark.id, mark.type])).toEqual([
			["ball", "Ball"],
			["ring", "Circle"],
			["box", "Rectangle"],
			["tri", "Triangle"],
		]);
		expect(marks[0].radius).toBe(12 * k);
		expect(marks[1].radius).toBe(20 * k);
		expect(marks[2].radius).toBeCloseTo(Math.hypot(20, 20) * k);
	});

	it("sketches the floorball field in scene units", () => {
		const field = full.field;

		expect(field.rink).toEqual({ x: 0, y: 0, width: 2000, height: 1000, cornerRadius: 100 });
		expect(field.centerLine).toEqual({ x: 1000, y1: 0, y2: 1000 });
		expect(field.goalAreas).toHaveLength(2);
		expect(field.goalAreas[0].x).toBeCloseTo(100);
		expect(field.goalAreas[1].x + field.goalAreas[1].width).toBeCloseTo(1900);
		expect(field.goals).toHaveLength(2);
		expect(field.goals[0]).toBe("M 197.4 416.5 L 157.4 416.5 L 157.4 583.5 L 197.4 583.5");
	});
});
