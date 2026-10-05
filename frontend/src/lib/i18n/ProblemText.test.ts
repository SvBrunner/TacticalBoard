import { describe, it, expect } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { de, en } from "$lib/testing/i18n";
import { ProblemText } from "./ProblemText";

const problem = (code: string, extra: Record<string, unknown> = {}) =>
	new ApiError(400, { type: `https://tacticalboard/errors/${code}`, title: "English title", detail: "English detail.", ...extra });
const fallback = () => "Fallback.";

describe("ProblemText", () => {
	it("words no server and an ended session", () => {
		expect(ProblemText.describe(new ApiUnavailableError(), fallback)(en)).toBe("The server is not reachable. Please try again later.");
		expect(ProblemText.describe(new ApiError(401, {}), fallback)(de)).toBe("Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.");
		expect(ProblemText.isSessionEnded(new ApiError(401, null))).toBe(true);
		expect(ProblemText.isSessionEnded(new ApiError(403, null))).toBe(false);
	});

	it("words a known problem code in the UI language, never the server's English text", () => {
		const error = problem("folder-not-empty");

		expect(ProblemText.describe(error, fallback)(en)).toBe("The folder still contains situations.");
		expect(ProblemText.describe(error, fallback)(de)).toBe("Der Ordner enthält noch Situationen.");
	});

	it("falls back for unknown codes, problems without a code, and other errors", () => {
		expect(ProblemText.describe(problem("something-new"), fallback)(en)).toBe("Fallback.");
		expect(ProblemText.describe(new ApiError(500, {}), fallback)(en)).toBe("Fallback.");
		expect(ProblemText.describe(new ApiError(500, { type: "https://example.org/other" }), fallback)(en)).toBe("Fallback.");
		expect(ProblemText.describe(new TypeError("x"), fallback)(en)).toBe("Fallback.");
		expect(ProblemText.describe(problem("something-new"))(de)).toBe("Etwas ist schiefgelaufen. Bitte versuche es erneut.");
	});

	it("words the logo upload problems with their limits", () => {
		const error = problem("validation-failed", {
			fieldErrors: {
				logo: [{ code: "file-too-large", maxBytes: 5 * 1024 * 1024 }, { code: "unsupported-image" }, { code: "image-too-large", maxMegapixels: 25 }],
			},
		});

		expect(ProblemText.describe(error, fallback)(en)).toBe(
			"logo must be at most 5 MB; logo must be a PNG, JPEG or WebP image; logo must have at most 25 megapixels",
		);
		expect(ProblemText.fieldError(error, "logo")!(de)).toBe("darf höchstens 5 MB groß sein");
		expect(ProblemText.fieldProblem(en, { code: "file-too-large" })).toBe("is invalid");
		expect(ProblemText.fieldProblem(en, { code: "image-too-large" })).toBe("is invalid");
		expect(ProblemText.megabytes(1572864)).toBe(1.5);
	});

	it("words the team problems", () => {
		expect(ProblemText.describe(problem("team-not-found"), fallback)(en)).toBe("This team doesn't exist (any more).");
		expect(ProblemText.describe(problem("duplicate-team-name"), fallback)(de)).toBe("Ein Team mit diesem Namen existiert bereits.");
		expect(ProblemText.describe(problem("content-too-large"), fallback)(en)).toBe("The file is too large.");
	});

	it("lists field errors by their codes, with their values", () => {
		const error = problem("validation-failed", {
			errors: { name: ["x"], "document.situation.frames": ["y"] },
			fieldErrors: { name: [{ code: "too-long", maxLength: 100 }], "document.situation.frames": [{ code: "expected-frame" }] },
		});

		expect(ProblemText.describe(error, fallback)(en)).toBe(
			"name must be at most 100 characters long; document.situation.frames must contain at least one frame",
		);
		expect(ProblemText.fieldError(error, "name")?.(de)).toBe("darf höchstens 100 Zeichen lang sein");
		expect(ProblemText.fieldError(error, "other")).toBeNull();
	});

	it.each<[Record<string, unknown>, string]>([
		[{ code: "required" }, "must not be empty"],
		[{ code: "control-characters" }, "must not contain control characters"],
		[{ code: "expected-value", expected: "tacticalboard.situation" }, "must be “tacticalboard.situation”"],
		[{ code: "expected-current-version", version: 3 }, "must be 3 (the current format version)"],
		[{ code: "duplicate-id", id: "e1" }, "repeats the id “e1”"],
		[{ code: "too-long" }, "is invalid"],
		[{ code: "expected-value" }, "is invalid"],
		[{ code: "expected-current-version" }, "is invalid"],
		[{ code: "duplicate-id" }, "is invalid"],
		[{ code: "brand-new-code" }, "is invalid"],
		[{ code: "field" }, "is invalid"],
	])("words the field code %j", (error, text) => {
		expect(ProblemText.fieldProblem(en, error as { code: string })).toBe(text);
	});

	it("forCode words a code or falls back", () => {
		expect(ProblemText.forCode("forbidden")(de)).toBe("Das darfst du nicht.");
		expect(ProblemText.forCode(undefined, fallback)(en)).toBe("Fallback.");
		expect(ProblemText.forCode("nope")(en)).toBe("Something went wrong. Please try again.");
	});
});
