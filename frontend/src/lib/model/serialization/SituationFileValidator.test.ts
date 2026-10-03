import { describe, it, expect } from "vitest";
import { SituationFileValidator } from "./SituationFileValidator";
import fixtureV2 from "./__fixtures__/situation-v2.json";
import fixture from "./__fixtures__/situation-v3.json";

type Json = Record<string, any>;

function minimalFile(): Json {
	return {
		format: "tacticalboard.situation",
		formatVersion: 3,
		situation: {
			id: "s",
			title: "",
			description: "",
			sport: "floorball",
			fieldType: "full",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			frames: [{ id: "f1", description: "", elements: [{ id: "e1", type: "Player", color: "red", x: 0, y: 0, label: "" }] }],
		},
	};
}

function issuesFor(mutate: (file: Json) => void): string[] {
	const file = minimalFile();
	mutate(file);
	return new SituationFileValidator().validate(file).map((issue) => `${issue.path}: ${issue.message}`);
}

describe("SituationFileValidator", () => {
	const validator = new SituationFileValidator();

	it("accepts a minimal file", () => {
		expect(validator.validate(minimalFile())).toEqual([]);
		expect(validator.isValid(minimalFile())).toBe(true);
	});

	it("accepts the v3 fixture with arrows", () => {
		expect(validator.validate(fixture)).toEqual([]);
	});

	it("accepts the content of the v2 fixture (point elements are unchanged in v3)", () => {
		expect(validator.validate({ ...fixtureV2, formatVersion: 3 })).toEqual([]);
	});

	it("accepts a frame without elements", () => {
		expect(issuesFor((file) => (file.situation.frames[0].elements = []))).toEqual([]);
	});

	it("accepts timestamps with an offset and without milliseconds", () => {
		expect(
			issuesFor((file) => {
				file.situation.createdAt = "2026-01-01T10:00:00+02:00";
				file.situation.updatedAt = "2026-01-01T10:00Z";
			}),
		).toEqual([]);
	});

	it("ignores unknown extra properties", () => {
		expect(
			issuesFor((file) => {
				file.extra = true;
				file.situation.extra = { nested: 1 };
				file.situation.frames[0].extra = "x";
				file.situation.frames[0].elements[0].tag = "C";
			}),
		).toEqual([]);
	});

	it("allows the same element id in different frames", () => {
		expect(
			issuesFor((file) => {
				file.situation.frames.push({
					id: "f2",
					description: "",
					elements: [{ id: "e1", type: "Player", color: "red", x: 5, y: 5, label: "" }],
				});
			}),
		).toEqual([]);
	});

	it("allows any number of balls and players", () => {
		expect(
			issuesFor((file) => {
				file.situation.frames[0].elements = Array.from({ length: 30 }, (_, i) => ({
					id: `e${i}`,
					type: i % 2 === 0 ? "Ball" : "Player",
					color: "red",
					x: i,
					y: i,
					label: "",
				}));
			}),
		).toEqual([]);
	});

	it.each([[""], ["C"], ["LV"], ["10"], ["c"], ["Ü"]])("accepts the label %j", (label) => {
		expect(issuesFor((file) => (file.situation.frames[0].elements[0].label = label))).toEqual([]);
	});

	it("accepts a label on a non-player element (kept hidden)", () => {
		expect(
			issuesFor((file) => {
				file.situation.frames[0].elements[0].type = "Circle";
				file.situation.frames[0].elements[0].label = "C";
			}),
		).toEqual([]);
	});

	it.each([[null], [[]], ["text"], [42]])("rejects a non-object root %j", (value) => {
		expect(validator.validate(value).map((issue) => issue.path)).toEqual(["(root)"]);
	});

	it.each<[string, (file: Json) => void, string]>([
		["wrong format", (f) => (f.format = "other"), 'format: expected "tacticalboard.situation"'],
		["missing format", (f) => delete f.format, 'format: expected "tacticalboard.situation"'],
		["zero formatVersion", (f) => (f.formatVersion = 0), "formatVersion: expected positive integer"],
		["fractional formatVersion", (f) => (f.formatVersion = 1.5), "formatVersion: expected positive integer"],
		["string formatVersion", (f) => (f.formatVersion = "1"), "formatVersion: expected positive integer"],
		["missing situation", (f) => delete f.situation, "situation: expected object"],
		["empty situation id", (f) => (f.situation.id = ""), "situation.id: expected non-empty string"],
		["missing situation id", (f) => delete f.situation.id, "situation.id: expected non-empty string"],
		["non-string title", (f) => (f.situation.title = 5), "situation.title: expected string"],
		["non-string description", (f) => (f.situation.description = null), "situation.description: expected string"],
		["unsupported sport", (f) => (f.situation.sport = "hockey"), "situation.sport: expected supported sport"],
		["invalid fieldType", (f) => (f.situation.fieldType = "quarter"), 'situation.fieldType: expected "full" or "half"'],
		["invalid createdAt", (f) => (f.situation.createdAt = "yesterday"), "situation.createdAt: expected ISO 8601 timestamp"],
		["impossible updatedAt", (f) => (f.situation.updatedAt = "2026-13-45T99:00:00Z"), "situation.updatedAt: expected ISO 8601 timestamp"],
		["date-only updatedAt", (f) => (f.situation.updatedAt = "2026-01-01"), "situation.updatedAt: expected ISO 8601 timestamp"],
		["frames not an array", (f) => (f.situation.frames = {}), "situation.frames: expected array"],
		["empty frames", (f) => (f.situation.frames = []), "situation.frames: expected at least one frame"],
		["frame not an object", (f) => (f.situation.frames[0] = "frame"), "situation.frames[0]: expected object"],
		["empty frame id", (f) => (f.situation.frames[0].id = ""), "situation.frames[0].id: expected non-empty string"],
		[
			"non-string frame description",
			(f) => (f.situation.frames[0].description = 1),
			"situation.frames[0].description: expected string",
		],
		["elements not an array", (f) => (f.situation.frames[0].elements = null), "situation.frames[0].elements: expected array"],
		[
			"element not an object",
			(f) => (f.situation.frames[0].elements[0] = 7),
			"situation.frames[0].elements[0]: expected object",
		],
		[
			"empty element id",
			(f) => (f.situation.frames[0].elements[0].id = ""),
			"situation.frames[0].elements[0].id: expected non-empty string",
		],
		[
			"unknown element type",
			(f) => (f.situation.frames[0].elements[0].type = "Arrow"),
			"situation.frames[0].elements[0].type: expected known element type",
		],
		[
			"empty color",
			(f) => (f.situation.frames[0].elements[0].color = ""),
			"situation.frames[0].elements[0].color: expected non-empty string",
		],
		[
			"string x",
			(f) => (f.situation.frames[0].elements[0].x = "1"),
			"situation.frames[0].elements[0].x: expected finite number",
		],
		[
			"infinite y",
			(f) => (f.situation.frames[0].elements[0].y = Infinity),
			"situation.frames[0].elements[0].y: expected finite number",
		],
		["NaN y", (f) => (f.situation.frames[0].elements[0].y = NaN), "situation.frames[0].elements[0].y: expected finite number"],
		...(
			[
				["missing label", (f: Json) => delete f.situation.frames[0].elements[0].label],
				["non-string label", (f: Json) => (f.situation.frames[0].elements[0].label = 7)],
				["null label", (f: Json) => (f.situation.frames[0].elements[0].label = null)],
				["too long label", (f: Json) => (f.situation.frames[0].elements[0].label = "ABC")],
				["label with a space", (f: Json) => (f.situation.frames[0].elements[0].label = "L V")],
				["label with punctuation", (f: Json) => (f.situation.frames[0].elements[0].label = "#9")],
			] as [string, (file: Json) => void][]
		).map(([name, mutate]): [string, (file: Json) => void, string] => [
			name,
			mutate,
			"situation.frames[0].elements[0].label: expected string of at most 2 letters or digits",
		]),
	])("rejects %s", (_name, mutate, expected) => {
		expect(issuesFor(mutate)).toEqual([expected]);
	});

	it("rejects duplicate frame ids", () => {
		expect(
			issuesFor((file) => {
				file.situation.frames.push({ id: "f1", description: "", elements: [] });
			}),
		).toEqual(['situation.frames[1].id: duplicate frame id "f1"']);
	});

	it("rejects duplicate element ids within a frame", () => {
		expect(
			issuesFor((file) => {
				file.situation.frames[0].elements.push({ id: "e1", type: "Ball", color: "black", x: 1, y: 1, label: "" });
			}),
		).toEqual(['situation.frames[0].elements[1].id: duplicate element id "e1" in frame']);
	});

	it("reports multiple issues at once", () => {
		expect(
			issuesFor((file) => {
				file.situation.title = 1;
				file.situation.fieldType = "quarter";
				file.situation.frames[0].elements[0].x = null;
				file.situation.frames[0].elements.push({ id: "e2", type: "Unknown", color: "", x: 0, y: 0, label: "" });
			}),
		).toEqual([
			"situation.title: expected string",
			'situation.fieldType: expected "full" or "half"',
			"situation.frames[0].elements[0].x: expected finite number",
			"situation.frames[0].elements[1].type: expected known element type",
			"situation.frames[0].elements[1].color: expected non-empty string",
		]);
	});

	describe("arrows", () => {
		function arrowFile(): Json {
			const file = minimalFile();
			file.situation.frames[0].elements = [
				{ id: "a1", type: "Pass", color: "black", start: { x: 0, y: 0 }, end: { x: 10, y: 20 }, bends: [] },
			];
			return file;
		}

		function arrowIssues(mutate: (arrow: Json) => void): string[] {
			const file = arrowFile();
			mutate(file.situation.frames[0].elements[0]);
			return validator.validate(file).map((issue) => `${issue.path}: ${issue.message}`);
		}

		it.each([["Pass"], ["Run"], ["Shot"]])("accepts a straight %s arrow", (type) => {
			expect(arrowIssues((arrow) => (arrow.type = type))).toEqual([]);
		});

		it("accepts several bends", () => {
			expect(arrowIssues((arrow) => (arrow.bends = [{ x: 1, y: 1 }, { x: 2.5, y: -3 }, { x: 4, y: 4 }]))).toEqual([]);
		});

		it("needs no x, y or label and ignores them and other extra properties", () => {
			expect(arrowIssues((arrow) => Object.assign(arrow, { x: "nonsense", label: "TOO LONG", note: 1 }))).toEqual([]);
			expect(arrowIssues((arrow) => (arrow.start.z = 3))).toEqual([]);
		});

		it.each<[string, (arrow: Json) => void, string[]]>([
			["missing start", (a) => delete a.start, ["start: expected object with x and y"]],
			["start not an object", (a) => (a.start = [1, 2]), ["start: expected object with x and y"]],
			["non-numeric start.x", (a) => (a.start.x = "1"), ["start.x: expected finite number"]],
			["missing end", (a) => delete a.end, ["end: expected object with x and y"]],
			["infinite end.y", (a) => (a.end.y = Infinity), ["end.y: expected finite number"]],
			["missing bends", (a) => delete a.bends, ["bends: expected array"]],
			["bends not an array", (a) => (a.bends = { x: 1, y: 1 }), ["bends: expected array"]],
			["a bend that is not an object", (a) => (a.bends = [{ x: 1, y: 1 }, 7]), ["bends[1]: expected object with x and y"]],
			["a bend without y", (a) => (a.bends = [{ x: 1 }]), ["bends[0].y: expected finite number"]],
			["an empty color", (a) => (a.color = ""), ["color: expected non-empty string"]],
		])("rejects %s", (_name, mutate, expected) => {
			expect(arrowIssues(mutate)).toEqual(expected.map((issue) => `situation.frames[0].elements[0].${issue}`));
		});

		it("reports all arrow issues at once", () => {
			expect(
				arrowIssues((arrow) => {
					arrow.start = null;
					arrow.end.x = NaN;
					arrow.bends = [null];
				}),
			).toEqual([
				"situation.frames[0].elements[0].start: expected object with x and y",
				"situation.frames[0].elements[0].end.x: expected finite number",
				"situation.frames[0].elements[0].bends[0]: expected object with x and y",
			]);
		});

		it("checks a point element's x, y and label, not an arrow's start and end", () => {
			expect(
				arrowIssues((arrow) => {
					arrow.type = "Player";
				}),
			).toEqual([
				"situation.frames[0].elements[0].x: expected finite number",
				"situation.frames[0].elements[0].y: expected finite number",
				"situation.frames[0].elements[0].label: expected string of at most 2 letters or digits",
			]);
		});
	});
});
