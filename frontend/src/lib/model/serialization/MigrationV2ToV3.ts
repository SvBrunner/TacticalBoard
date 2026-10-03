import type { Migration, SituationFileData } from "./SituationFileMigrator";

/**
 * Format 2 → 3: version 3 adds arrow elements (`Pass`, `Run`, `Shot` with
 * `start`, `end` and `bends`). Version 2 files can't contain arrows and
 * their point elements are unchanged, so the content passes through as it
 * is; the migration exists because every format version step has one (the
 * migrator sets `formatVersion`). Does not mutate its input.
 */
export class MigrationV2ToV3 implements Migration {
	readonly fromVersion = 2;

	migrate(file: SituationFileData): SituationFileData {
		return file;
	}
}
