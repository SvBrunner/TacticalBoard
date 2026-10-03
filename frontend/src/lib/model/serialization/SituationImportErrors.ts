/** Base class of every error raised while importing a situation file. */
export class SituationImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = new.target.name;
	}
}

export class InvalidJsonError extends SituationImportError {
	constructor(readonly parseError: unknown) {
		super("The file is not valid JSON");
	}
}

export class UnrecognizedFileError extends SituationImportError {
	constructor() {
		super("The file is not a TacticalBoard situation file");
	}
}

export class LegacyFormatNotSupportedError extends SituationImportError {
	constructor() {
		super("This file uses an old format that is no longer supported");
	}
}

export class UnsupportedFormatVersionError extends SituationImportError {
	constructor(
		readonly formatVersion: number,
		readonly supportedVersion: number,
		message = `This file uses format version ${formatVersion}, but this app only supports up to version ${supportedVersion}. Please update the app.`,
	) {
		super(message);
	}
}

export interface ValidationIssue {
	readonly path: string;
	readonly message: string;
}

export function formatIssue(issue: ValidationIssue): string {
	return `${issue.path}: ${issue.message}`;
}

export class InvalidSituationFileError extends SituationImportError {
	constructor(readonly issues: readonly ValidationIssue[]) {
		super(`The situation file is invalid:\n${issues.map(formatIssue).join("\n")}`);
	}
}
