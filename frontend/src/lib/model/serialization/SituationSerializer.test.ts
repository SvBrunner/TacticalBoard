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
import fixtureV1 from "./__fixtures__/situation-v1.json";
import fixtureV2 from "./__fixtures__/situation-v2.json";
import fixture from "./__fixtures__/situation-v3.json";
import { ArrowElement } from "../elements/ArrowElement";
import { ArrowGeometry } from "../elements/ArrowGeometry";

const player = new PointElement("p1", 100, 200, "oklch(62% 0.16 230)", "Player", "C");
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

	it("deserializes the v3 fixture with its arrows", () => {
		const restored = serializer.deserialize(JSON.stringify(fixture));

		expect(restored.id).toBe("situation-3");
		const [first, second] = restored.frames;
		expect(first.elements.map((element) => element.type)).toEqual(["Pass", "Run", "Player", "Player", "Ball"]);
		expect(first.findElement("run-1")).toBeInstanceOf(ArrowElement);
		expect((first.findElement("run-1") as ArrowElement).bends).toEqual([
			{ x: 1300, y: 200 },
			{ x: 1450, y: 220 },
		]);
		expect((second.findElement("pass-1") as ArrowElement).bends).toEqual([{ x: 1550, y: 450 }]);
		expect(second.findElement("shot-1")).toMatchObject({ type: "Shot", color: "oklch(64% 0.16 32)" });
	});

	it("still imports v2 files with their labels", () => {
		const restored = serializer.deserialize(JSON.stringify(fixtureV2));

		expect(restored.id).toBe("situation-1");
		expect(restored.frames).toHaveLength(2);
		expect(restored.frames[1].elements).toHaveLength(4);
		expect(restored.frames[0].findElement("player-2")).toMatchObject({ label: "10" });
		expect(restored.frames[1].findElement("player-2")).toMatchObject({ label: "LV" });
	});

	it("still imports v1 files: their elements have no label", () => {
		const restored = serializer.deserialize(JSON.stringify(fixtureV1));

		expect(restored.frames[1].elements).toHaveLength(4);
		expect(restored.frames.flatMap((frame) => frame.elements.map((element) => (element as PointElement).label))).toEqual(
			Array(7).fill(""),
		);
		expect(restored.frames[0].findElement("player-1")).toMatchObject({ x: 1200, y: 300, type: "Player" });
	});

	it("round-trips arrows with several bends", () => {
		const arrow = new ArrowElement(
			"a1",
			"Shot",
			"black",
			new ArrowGeometry({ x: 1, y: 2 }, { x: 300, y: 400 }, [{ x: 50, y: 60 }, { x: 70, y: 80 }]),
		);
		const withArrow = situation.updateFrame("f2", (frame) => frame.insertElement(arrow, 0));

		const restored = serializer.deserialize(serializer.serialize(withArrow));

		expect(restored).toEqual(withArrow);
		expect(restored.frames[1].elements[0]).toBeInstanceOf(ArrowElement);
	});

	it("writes format version 3 with labels", () => {
		const written = JSON.parse(serializer.serialize(situation));

		expect(written.formatVersion).toBe(3);
		expect(written.situation.frames[0].elements[0].label).toBe("C");
		expect(written.situation.frames[0].elements[1].label).toBe("");
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

	describe("documents (the server's form)", () => {
		it("turns a situation into the current-format document and back", () => {
			const document = serializer.toDocument(situation);

			expect(document).toMatchObject({ format: "tacticalboard.situation", formatVersion: 3 });
			expect(document.situation.id).toBe("s");
			expect(serializer.fromDocument(document)).toEqual(situation);
		});

		it("keeps the id and timestamps of a document (unlike an import)", () => {
			const restored = serializer.fromDocument(fixture);

			expect(restored.id).toBe("situation-3");
			expect(restored.createdAt).toBe("2026-10-01T10:00:00.000Z");
		});

		it("migrates an older document", () => {
			expect(serializer.fromDocument(fixtureV2).frames[0].elements.length).toBeGreaterThan(0);
		});

		it("rejects an invalid document", () => {
			expect(() => serializer.fromDocument({ ...fixture, situation: { ...fixture.situation, frames: [] } })).toThrow(
				InvalidSituationFileError,
			);
		});
	});
});
