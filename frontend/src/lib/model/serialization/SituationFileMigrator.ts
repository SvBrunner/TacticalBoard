import { MigrationV1ToV2 } from "./MigrationV1ToV2";
import { MigrationV2ToV3 } from "./MigrationV2ToV3";
import { CURRENT_FORMAT_VERSION, SITUATION_FILE_FORMAT } from "./SituationFileDto";
import {
	InvalidSituationFileError,
	LegacyFormatNotSupportedError,
	UnrecognizedFileError,
	UnsupportedFormatVersionError,
} from "./SituationImportErrors";

export type SituationFileData = Record<string, unknown>;

/**
 * Upgrades a file from `fromVersion` to `fromVersion + 1`. The migrator sets
 * `formatVersion` on the result, so a migration only reshapes the content.
 */
export interface Migration {
	readonly fromVersion: number;
	migrate(file: SituationFileData): SituationFileData;
}

/** One migration per format version step, up to `CURRENT_FORMAT_VERSION`. */
export const SITUATION_FILE_MIGRATIONS: readonly Migration[] = [new MigrationV1ToV2(), new MigrationV2ToV3()];

/**
 * Recognizes a situation file and upgrades it step by step to the current
 * format version. Does not validate the content; that happens afterwards.
 */
export class SituationFileMigrator {
	private readonly migrations = new Map<number, Migration>();

	constructor(
		migrations: readonly Migration[] = SITUATION_FILE_MIGRATIONS,
		private readonly currentVersion: number = CURRENT_FORMAT_VERSION,
	) {
		for (const migration of migrations) {
			if (this.migrations.has(migration.fromVersion)) {
				throw new Error(`Duplicate migration from format version ${migration.fromVersion}`);
			}
			this.migrations.set(migration.fromVersion, migration);
		}
	}

	migrate(raw: unknown): SituationFileData {
		if (Array.isArray(raw)) {
			throw new LegacyFormatNotSupportedError();
		}
		if (typeof raw !== "object" || raw === null || (raw as SituationFileData).format !== SITUATION_FILE_FORMAT) {
			throw new UnrecognizedFileError();
		}
		let file = raw as SituationFileData;
		const version = file.formatVersion;
		if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
			throw new InvalidSituationFileError([{ path: "formatVersion", message: "expected positive integer" }]);
		}
		if (version > this.currentVersion) {
			throw new UnsupportedFormatVersionError(version, this.currentVersion);
		}
		for (let from = version; from < this.currentVersion; from++) {
			const migration = this.migrations.get(from);
			if (!migration) {
				throw new UnsupportedFormatVersionError(
					version,
					this.currentVersion,
					`Format version ${version} cannot be upgraded: no migration from version ${from}`,
				);
			}
			file = { ...migration.migrate(file), formatVersion: from + 1 };
		}
		return file;
	}
}
