import { describe, it, expect } from "vitest";
import {
	InvalidJsonError,
	InvalidSituationFileError,
	LegacyFormatNotSupportedError,
	SituationImportError,
	UnrecognizedFileError,
	UnsupportedFormatVersionError,
} from "./SituationImportErrors";

describe("SituationImportErrors", () => {
	it.each([
		[new InvalidJsonError(new SyntaxError("x"))],
		[new UnrecognizedFileError()],
		[new LegacyFormatNotSupportedError()],
		[new UnsupportedFormatVersionError(3, 1)],
		[new InvalidSituationFileError([])],
	])("%o is a SituationImportError with its own name", (error) => {
		expect(error).toBeInstanceOf(SituationImportError);
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe(error.constructor.name);
		expect(error.message).not.toBe("");
	});

	it("InvalidSituationFileError lists every issue in its message", () => {
		const error = new InvalidSituationFileError([
			{ path: "situation.title", message: "expected string" },
			{ path: "situation.frames", message: "expected array" },
		]);

		expect(error.issues).toHaveLength(2);
		expect(error.message).toContain("situation.title: expected string");
		expect(error.message).toContain("situation.frames: expected array");
	});

	it("UnsupportedFormatVersionError exposes the versions", () => {
		const error = new UnsupportedFormatVersionError(3, 1);

		expect(error.formatVersion).toBe(3);
		expect(error.supportedVersion).toBe(1);
		expect(error.message).toContain("version 3");
	});
});
