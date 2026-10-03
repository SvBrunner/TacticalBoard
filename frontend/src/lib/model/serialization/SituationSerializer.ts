import type { Situation } from "../Situation";
import type { SituationFileDto } from "./SituationFileDto";
import { SituationFileMigrator } from "./SituationFileMigrator";
import { SituationFileValidator } from "./SituationFileValidator";
import { InvalidJsonError, InvalidSituationFileError } from "./SituationImportErrors";
import { SituationMapper } from "./SituationMapper";

/** Facade for writing and reading situation files (parse → migrate → validate → map). */
export class SituationSerializer {
	constructor(
		private readonly mapper = new SituationMapper(),
		private readonly validator = new SituationFileValidator(),
		private readonly migrator = new SituationFileMigrator(),
	) {}

	serialize(situation: Situation): string {
		return JSON.stringify(this.mapper.toDto(situation), null, 2);
	}

	/** @throws SituationImportError (or a subclass) when the text is not a valid situation file. */
	deserialize(text: string): Situation {
		const migrated = this.migrator.migrate(this.parse(text));
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
