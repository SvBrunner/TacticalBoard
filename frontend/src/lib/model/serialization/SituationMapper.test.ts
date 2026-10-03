import { describe, it, expect } from "vitest";
import { PointElement } from "../elements/PointElement";
import { Frame } from "../Frame";
import { Situation } from "../Situation";
import { SituationMapper } from "./SituationMapper";
import fixture from "./__fixtures__/situation-v1.json";
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
			new PointElement("p1", 1, 2, "red", "Player"),
			new PointElement("b1", 3.5, 4.25, "black", "Ball"),
		]),
		new Frame("f2", "second", [new PointElement("p1", 10, 20, "red", "Player")]),
	],
});

describe("SituationMapper", () => {
	const mapper = new SituationMapper();

	it("toDto produces the v1 file shape", () => {
		expect(mapper.toDto(situation)).toEqual({
			format: "tacticalboard.situation",
			formatVersion: 1,
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
							{ id: "p1", type: "Player", color: "red", x: 1, y: 2 },
							{ id: "b1", type: "Ball", color: "black", x: 3.5, y: 4.25 },
						],
					},
					{ id: "f2", description: "second", elements: [{ id: "p1", type: "Player", color: "red", x: 10, y: 20 }] },
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

	it("toDto(fromDto(fixture)) reproduces the fixture", () => {
		const dto = fixture as SituationFileDto;

		expect(mapper.toDto(mapper.fromDto(dto))).toEqual(dto);
	});
});
