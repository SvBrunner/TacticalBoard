import { describe, it, expect } from "vitest";
import { PointElement } from "../elements/PointElement";
import { Frame } from "../Frame";
import { Situation } from "../Situation";
import {
	InvalidJsonError,
	InvalidSituationFileError,
	LegacyFormatNotSupportedError,
	SituationImportError,
	UnrecognizedFileError,
	UnsupportedFormatVersionError,
} from "./SituationImportErrors";
import { SituationSerializer } from "./SituationSerializer";
import fixture from "./__fixtures__/situation-v1.json";

const player = new PointElement("p1", 100, 200, "oklch(62% 0.16 230)", "Player");
const ball = new PointElement("b1", 110, 210, "oklch(45% 0.01 260)", "Ball");

const situation = new Situation({
	id: "s",
	title: "Überzahl",
	description: "# Heading\n\nSome **markdown**.",
	sport: "floorball",
	fieldType: "half",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-02T00:00:00.000Z",
	frames: [
		new Frame("f1", "Start", [player, ball]),
		new Frame("f2", "Pass", [player.withPosition(150, 250), ball.withPosition(600, 700)]),
		new Frame("f3", "", [player.withPosition(160, 260)]),
	],
});

describe("SituationSerializer", () => {
	const serializer = new SituationSerializer();

	it("round-trips a multi-frame half-field situation with repeated element ids across frames", () => {
		const restored = serializer.deserialize(serializer.serialize(situation));

		expect(restored).toEqual(situation);
		expect(restored.fieldType).toBe("half");
		expect(restored.frames.map((frame) => frame.elements[0].id)).toEqual(["p1", "p1", "p1"]);
	});

	it("serializes pretty-printed with a 2-space indent", () => {
		const text = serializer.serialize(situation);

		expect(text).toBe(JSON.stringify(JSON.parse(text), null, 2));
		expect(text).toContain('\n  "format": "tacticalboard.situation"');
	});

	it("deserializes the v1 fixture", () => {
		const restored = serializer.deserialize(JSON.stringify(fixture));

		expect(restored.id).toBe("situation-1");
		expect(restored.frames).toHaveLength(2);
		expect(restored.frames[1].elements).toHaveLength(4);
	});

	it.each<[string, string, new (...args: never[]) => SituationImportError]>([
		["invalid JSON", "{not json", InvalidJsonError],
		["an unrecognized file", JSON.stringify({ hello: "world" }), UnrecognizedFileError],
		["the legacy array format", JSON.stringify([{ id: "a", x: 0, y: 0, color: "red", type: "Player" }]), LegacyFormatNotSupportedError],
		[
			"a newer format version",
			JSON.stringify({ ...fixture, formatVersion: 99 }),
			UnsupportedFormatVersionError,
		],
		[
			"invalid content",
			JSON.stringify({ ...fixture, situation: { ...fixture.situation, frames: [] } }),
			InvalidSituationFileError,
		],
	])("rejects %s with a SituationImportError", (_name, text, errorType) => {
		let caught: unknown;
		try {
			serializer.deserialize(text);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(errorType);
		expect(caught).toBeInstanceOf(SituationImportError);
	});
});
