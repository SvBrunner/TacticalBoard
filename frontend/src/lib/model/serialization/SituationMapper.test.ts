import { describe, it, expect } from "vitest";
import { PointElement } from "../elements/PointElement";
import { Frame } from "../Frame";
import { Situation } from "../Situation";
import { SituationMapper } from "./SituationMapper";
import fixture from "./__fixtures__/situation-v3.json";
import { ArrowElement } from "../elements/ArrowElement";
import { ArrowGeometry } from "../elements/ArrowGeometry";
import type { SituationFileDto } from "./SituationFileDto";

const situation = new Situation({
	id: "s",
	title: "Breakout",
	description: "A *breakout*",
	sport: "floorball",
	fieldType: "half",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-02T00:00:00.000Z",
	frames: [
		new Frame("f1", "first", [
			new PointElement("p1", 1, 2, "red", "Player", "C"),
			new PointElement("b1", 3.5, 4.25, "black", "Ball"),
		]),
		new Frame("f2", "second", [new PointElement("p1", 10, 20, "red", "Player", "LV")]),
	],
});

describe("SituationMapper", () => {
	const mapper = new SituationMapper();

	it("toDto produces the v3 file shape for point elements", () => {
		expect(mapper.toDto(situation)).toEqual({
			format: "tacticalboard.situation",
			formatVersion: 3,
			situation: {
				id: "s",
				title: "Breakout",
				description: "A *breakout*",
				sport: "floorball",
				fieldType: "half",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
				frames: [
					{
						id: "f1",
						description: "first",
						elements: [
							{ id: "p1", type: "Player", color: "red", x: 1, y: 2, label: "C" },
							{ id: "b1", type: "Ball", color: "black", x: 3.5, y: 4.25, label: "" },
						],
					},
					{ id: "f2", description: "second", elements: [{ id: "p1", type: "Player", color: "red", x: 10, y: 20, label: "LV" }] },
				],
			},
		});
	});

	it("fromDto(toDto(situation)) round-trips", () => {
		expect(mapper.fromDto(mapper.toDto(situation))).toEqual(situation);
	});

	it("fromDto creates point elements", () => {
		const restored = mapper.fromDto(mapper.toDto(situation));

		expect(restored).toBeInstanceOf(Situation);
		expect(restored.frames[0]).toBeInstanceOf(Frame);
		expect(restored.frames[0].elements[0]).toBeInstanceOf(PointElement);
	});

	it("round-trips labels per frame, including a hidden label of a non-player", () => {
		const hidden = new PointElement("m1", 5, 5, "grey", "Circle", "F");
		const withHidden = situation.updateFrame("f1", (frame) => frame.addElement(hidden));

		const restored = mapper.fromDto(mapper.toDto(withHidden));

		expect(restored.frames[0].findElement("p1")).toMatchObject({ label: "C" });
		expect(restored.frames[0].findElement("m1")).toMatchObject({ type: "Circle", label: "F" });
		expect(restored.frames[1].findElement("p1")).toMatchObject({ label: "LV" });
	});

	it("toDto(fromDto(fixture)) reproduces the fixture", () => {
		const dto = fixture as SituationFileDto;

		expect(mapper.toDto(mapper.fromDto(dto))).toEqual(dto);
	});

	describe("arrows", () => {
		const pass = new ArrowElement("a1", "Pass", "black", ArrowGeometry.straight({ x: 1, y: 2 }, { x: 3, y: 4 }));
		const run = new ArrowElement(
			"a2",
			"Run",
			"blue",
			new ArrowGeometry({ x: 10, y: 20 }, { x: 50, y: 60 }, [{ x: 20, y: 40 }, { x: 35.5, y: 41.25 }]),
		);
		const withArrows = situation.updateFrame("f1", (frame) => frame.insertElement(pass, 0).addElement(run));

		it("toDto writes start, end and bends and no x, y or label", () => {
			const elements = mapper.toDto(withArrows).situation.frames[0].elements;

			expect(elements[0]).toEqual({ id: "a1", type: "Pass", color: "black", start: { x: 1, y: 2 }, end: { x: 3, y: 4 }, bends: [] });
			expect(elements.at(-1)).toEqual({
				id: "a2",
				type: "Run",
				color: "blue",
				start: { x: 10, y: 20 },
				end: { x: 50, y: 60 },
				bends: [{ x: 20, y: 40 }, { x: 35.5, y: 41.25 }],
			});
		});

		it("round-trips arrows mixed with point elements, keeping the z-order", () => {
			const restored = mapper.fromDto(mapper.toDto(withArrows));

			expect(restored).toEqual(withArrows);
			expect(restored.frames[0].elements.map((element) => element.id)).toEqual(["a1", "p1", "b1", "a2"]);
			expect(restored.frames[0].elements[0]).toBeInstanceOf(ArrowElement);
			expect(restored.frames[0].elements[1]).toBeInstanceOf(PointElement);
		});

		it("fromDto drops extra properties of points", () => {
			const dto = mapper.toDto(withArrows);
			(dto.situation.frames[0].elements[0] as { start: object }).start = { x: 1, y: 2, z: 9 };

			expect((mapper.fromDto(dto).frames[0].elements[0] as ArrowElement).start).toEqual({ x: 1, y: 2 });
		});
	});
});
