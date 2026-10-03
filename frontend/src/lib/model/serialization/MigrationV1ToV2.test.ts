import { describe, it, expect } from "vitest";
import { MigrationV1ToV2 } from "./MigrationV1ToV2";

const migration = new MigrationV1ToV2();

function v1(frames: unknown) {
	return { format: "tacticalboard.situation", formatVersion: 1, situation: { id: "s", title: "t", frames } };
}

describe("MigrationV1ToV2", () => {
	it("migrates from version 1", () => {
		expect(migration.fromVersion).toBe(1);
	});

	it("adds an empty label to every element of every frame and keeps everything else", () => {
		const input = v1([
			{ id: "f1", description: "a", elements: [{ id: "p", type: "Player", color: "red", x: 1, y: 2 }] },
			{ id: "f2", description: "b", elements: [{ id: "b", type: "Ball", color: "grey", x: 3, y: 4 }] },
		]);

		expect(migration.migrate(input)).toEqual(
			v1([
				{ id: "f1", description: "a", elements: [{ id: "p", type: "Player", color: "red", x: 1, y: 2, label: "" }] },
				{ id: "f2", description: "b", elements: [{ id: "b", type: "Ball", color: "grey", x: 3, y: 4, label: "" }] },
			]),
		);
	});

	it("replaces a label property v1 ignored", () => {
		const migrated = migration.migrate(v1([{ id: "f", description: "", elements: [{ id: "p", label: "XYZ" }] }]));

		expect((migrated.situation as any).frames[0].elements[0].label).toBe("");
	});

	it("does not mutate its input", () => {
		const input = v1([{ id: "f", description: "", elements: [{ id: "p" }] }]);
		const copy = structuredClone(input);

		migration.migrate(input);

		expect(input).toEqual(copy);
	});

	it.each([
		["no situation", { format: "tacticalboard.situation", formatVersion: 1 }],
		["a non-object situation", { formatVersion: 1, situation: "x" }],
		["frames that are not an array", v1({})],
	])("passes %s through for the validator to report", (_name, input) => {
		expect(migration.migrate(input)).toBe(input);
	});

	it("passes malformed frames and elements through unchanged", () => {
		const migrated = migration.migrate(v1(["frame", { id: "f", elements: "none" }, { id: "g", elements: [7, null] }]));

		expect((migrated.situation as any).frames).toEqual(["frame", { id: "f", elements: "none" }, { id: "g", elements: [7, null] }]);
	});
});
