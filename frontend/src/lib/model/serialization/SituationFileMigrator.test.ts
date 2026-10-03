import { describe, it, expect } from "vitest";
import { SituationFileMigrator, SITUATION_FILE_MIGRATIONS, type Migration } from "./SituationFileMigrator";
import {
	InvalidSituationFileError,
	LegacyFormatNotSupportedError,
	UnrecognizedFileError,
	UnsupportedFormatVersionError,
} from "./SituationImportErrors";
import fixture from "./__fixtures__/situation-v1.json";

function file(formatVersion: unknown, extra: Record<string, unknown> = {}) {
	return { format: "tacticalboard.situation", formatVersion, ...extra };
}

describe("SituationFileMigrator", () => {
	it("has no migrations registered yet", () => {
		expect(SITUATION_FILE_MIGRATIONS).toEqual([]);
	});

	it("passes a current-version file through unchanged", () => {
		expect(new SituationFileMigrator().migrate(fixture)).toEqual(fixture);
	});

	it("rejects a newer format version", () => {
		const migrate = () => new SituationFileMigrator().migrate(file(2));

		expect(migrate).toThrow(UnsupportedFormatVersionError);
		expect(migrate).toThrow(/version 2/);
	});

	it.each([[undefined], [0], [-1], [1.5], ["1"], [null]])("rejects a missing or invalid version %j", (version) => {
		const raw = version === undefined ? { format: "tacticalboard.situation" } : file(version);

		expect(() => new SituationFileMigrator().migrate(raw)).toThrow(InvalidSituationFileError);
	});

	it.each([[null], ["text"], [42], [{}], [{ format: "something.else", formatVersion: 1 }]])(
		"rejects an unrecognized file %j",
		(raw) => {
			expect(() => new SituationFileMigrator().migrate(raw)).toThrow(UnrecognizedFileError);
		},
	);

	it("rejects the legacy array format with a clear message", () => {
		const legacy = [{ id: "a", x: 1, y: 2, color: "red", type: "Player" }];
		const migrate = () => new SituationFileMigrator().migrate(legacy);

		expect(migrate).toThrow(LegacyFormatNotSupportedError);
		expect(migrate).toThrow("This file uses an old format that is no longer supported");
	});

	describe("with test migrations", () => {
		const v1ToV2: Migration = {
			fromVersion: 1,
			migrate: (data) => ({ ...data, steps: [...((data.steps as string[]) ?? []), "1->2"] }),
		};
		const v2ToV3: Migration = {
			fromVersion: 2,
			migrate: (data) => ({ ...data, steps: [...((data.steps as string[]) ?? []), "2->3"] }),
		};

		it("chains migrations in order up to the current version", () => {
			const migrator = new SituationFileMigrator([v2ToV3, v1ToV2], 3);

			expect(migrator.migrate(file(1))).toEqual(file(3, { steps: ["1->2", "2->3"] }));
		});

		it("starts at the file's version", () => {
			const migrator = new SituationFileMigrator([v1ToV2, v2ToV3], 3);

			expect(migrator.migrate(file(2))).toEqual(file(3, { steps: ["2->3"] }));
		});

		it("does not mutate the input", () => {
			const input = file(1);
			new SituationFileMigrator([v1ToV2, v2ToV3], 3).migrate(input);

			expect(input).toEqual(file(1));
		});

		it("rejects a version whose migration chain has a gap", () => {
			const migrator = new SituationFileMigrator([v2ToV3], 3);

			expect(() => migrator.migrate(file(1))).toThrow(UnsupportedFormatVersionError);
		});

		it("rejects duplicate migrations for the same version", () => {
			expect(() => new SituationFileMigrator([v1ToV2, v1ToV2], 2)).toThrow(/Duplicate/);
		});
	});
});
