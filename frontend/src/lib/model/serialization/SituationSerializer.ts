import type { Situation } from "../Situation";
import type { SituationFileDto } from "./SituationFileDto";
import { SituationFileMigrator } from "./SituationFileMigrator";
import { SituationFileValidator } from "./SituationFileValidator";
import { InvalidJsonError, InvalidSituationFileError } from "./SituationImportErrors";
import { SituationMapper } from "./SituationMapper";

/**
 * Facade for writing and reading situation files (parse → migrate → validate
 * → map). The same format is the situation document the server stores
 * (arc42 ch. 8.15): `toDocument` / `fromDocument` work on the parsed JSON.
 */
export class SituationSerializer {
	constructor(
		private readonly mapper = new SituationMapper(),
		private readonly validator = new SituationFileValidator(),
		private readonly migrator = new SituationFileMigrator(),
	) {}

	serialize(situation: Situation): string {
		return JSON.stringify(this.toDocument(situation), null, 2);
	}

	/** @throws SituationImportError (or a subclass) when the text is not a valid situation file. */
	deserialize(text: string): Situation {
		return this.fromDocument(this.parse(text));
	}

	/** The situation as a document in the current format (the parsed form of its file). */
	toDocument(situation: Situation): SituationFileDto {
		return this.mapper.toDto(situation);
	}

	/**
	 * Reads a parsed situation document (e.g. from the server): migrate →
	 * validate → map. Keeps its id and timestamps.
	 * @throws SituationImportError (or a subclass) when it is not a valid situation document.
	 */
	fromDocument(raw: unknown): Situation {
		const migrated = this.migrator.migrate(raw);
		const issues = this.validator.validate(migrated);
		if (issues.length > 0) {
			throw new InvalidSituationFileError(issues);
		}
		return this.mapper.fromDto(migrated as unknown as SituationFileDto);
	}

	private parse(text: string): unknown {
		try {
			return JSON.parse(text);
		} catch (error) {
			throw new InvalidJsonError(error);
		}
	}
}
