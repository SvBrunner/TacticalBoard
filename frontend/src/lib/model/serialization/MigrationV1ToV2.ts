import type { Migration, SituationFileData } from "./SituationFileMigrator";

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Format 1 → 2: every element gets a position `label`, empty (no label).
 * Version 1 had no labels, so a `label` property in a v1 file was an
 * ignored extra property and is replaced as well. Works on unvalidated
 * data: anything that isn't shaped as expected is passed through for the
 * validator to report. Does not mutate its input.
 */
export class MigrationV1ToV2 implements Migration {
	readonly fromVersion = 1;

	migrate(file: SituationFileData): SituationFileData {
		const situation = file.situation;
		if (!isObject(situation) || !Array.isArray(situation.frames)) {
			return file;
		}
		return { ...file, situation: { ...situation, frames: situation.frames.map((frame) => this.migrateFrame(frame)) } };
	}

	private migrateFrame(frame: unknown): unknown {
		if (!isObject(frame) || !Array.isArray(frame.elements)) {
			return frame;
		}
		return { ...frame, elements: frame.elements.map((element) => this.migrateElement(element)) };
	}

	private migrateElement(element: unknown): unknown {
		return isObject(element) ? { ...element, label: "" } : element;
	}
}
