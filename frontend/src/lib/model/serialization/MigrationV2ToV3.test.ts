import { describe, it, expect } from "vitest";
import { MigrationV2ToV3 } from "./MigrationV2ToV3";
import { SituationFileMigrator } from "./SituationFileMigrator";
import { SituationFileValidator } from "./SituationFileValidator";
import fixtureV1 from "./__fixtures__/situation-v1.json";
import fixtureV2 from "./__fixtures__/situation-v2.json";

describe("MigrationV2ToV3", () => {
	const migration = new MigrationV2ToV3();

	it("migrates from version 2", () => {
		expect(migration.fromVersion).toBe(2);
	});

	it("passes the content through unchanged (v2 has no arrows; point elements are the same in v3)", () => {
		const copy = structuredClone(fixtureV2);

		const migrated = migration.migrate(fixtureV2);

		expect(migrated).toEqual(copy);
		expect(fixtureV2).toEqual(copy);
	});

	it("passes malformed content through for the validator to report", () => {
		const malformed = { format: "tacticalboard.situation", formatVersion: 2, situation: "x" };

		expect(migration.migrate(malformed)).toBe(malformed);
	});

	it("chained by the migrator, a v2 file becomes a valid v3 file with the same content", () => {
		const migrated = new SituationFileMigrator().migrate(fixtureV2);

		expect(migrated).toEqual({ ...fixtureV2, formatVersion: 3 });
		expect(new SituationFileValidator().validate(migrated)).toEqual([]);
	});

	it("chained by the migrator, a v1 file goes 1 → 2 → 3", () => {
		const migrated = new SituationFileMigrator().migrate(fixtureV1);

		expect(migrated.formatVersion).toBe(3);
		const elements = (migrated.situation as { frames: { elements: { label: unknown }[] }[] }).frames.flatMap(
			(frame) => frame.elements,
		);
		expect(elements.every((element) => element.label === "")).toBe(true);
		expect(new SituationFileValidator().validate(migrated)).toEqual([]);
	});
});
