import { ApiError, ApiUnavailableError, type FieldErrorCode } from "$lib/api/ApiClient";
import type { Messages, Translatable } from "./Messages";

/**
 * Turns failed server requests into localized texts (arc42 ch. 8.2, 8.18):
 * the backend answers with stable codes (the Problem Details `type`, and a
 * code per invalid field), and only the frontend words them. The backend's
 * English `title`/`detail` are never shown. Unknown codes fall back to a
 * generic text.
 */
export class ProblemText {
	/** "The server is not reachable." */
	static readonly UNREACHABLE: Translatable = (m) => m.errors.unreachable;
	/** "Your session has ended." */
	static readonly SESSION_ENDED: Translatable = (m) => m.errors.sessionEnded;
	/** "Something went wrong." */
	static readonly GENERIC: Translatable = (m) => m.errors.generic;

	/** Whether the server said the session has ended (`401`). */
	static isSessionEnded(error: unknown): boolean {
		return error instanceof ApiError && error.status === 401;
	}

	/**
	 * The text for any failed request: no server, an ended session, the
	 * problem's own code, or else `fallback` (default: the generic text).
	 * Field errors of a `validation-failed` problem are listed.
	 */
	static describe(error: unknown, fallback: Translatable = ProblemText.GENERIC): Translatable {
		if (error instanceof ApiUnavailableError) {
			return ProblemText.UNREACHABLE;
		}
		if (!(error instanceof ApiError)) {
			return fallback;
		}
		if (error.status === 401) {
			return ProblemText.SESSION_ENDED;
		}
		const fields = ProblemText.fieldErrors(error);
		if (fields.length > 0) {
			return (m) => fields.map((field) => field(m)).join("; ");
		}
		return ProblemText.forCode(error.code, fallback);
	}

	/** The text of a problem code, or `fallback` when the catalog doesn't word it. */
	static forCode(code: string | undefined, fallback: Translatable = ProblemText.GENERIC): Translatable {
		return (m) => (code === undefined ? null : ProblemText.problemOf(m, code)) ?? fallback(m);
	}

	/** Every field problem of the error, as "<field> <problem>". */
	static fieldErrors(error: ApiError): Translatable[] {
		return error.fieldErrorCodes().map(([field, code]) => (m) => m.fieldErrors.field(field, ProblemText.fieldProblem(m, code)));
	}

	/** The first problem of `field`, as its predicate (e.g. "must not be empty"), or `null`. */
	static fieldError(error: ApiError, field: string): ((m: Messages) => string) | null {
		const found = error.fieldErrorCodes().find(([name]) => name === field);
		return found ? (m) => ProblemText.fieldProblem(m, found[1]) : null;
	}

	/** The predicate for one field error code (e.g. "must be at most 100 characters long"). */
	static fieldProblem(m: Messages, error: FieldErrorCode): string {
		const texts = m.fieldErrors;
		switch (error.code) {
			case "too-long":
				return typeof error.maxLength === "number" ? texts["too-long"](error.maxLength) : texts.invalid;
			case "expected-value":
				return typeof error.expected === "string" ? texts["expected-value"](error.expected) : texts.invalid;
			case "expected-current-version":
				return typeof error.version === "number" ? texts["expected-current-version"](error.version) : texts.invalid;
			case "duplicate-id":
				return typeof error.id === "string" ? texts["duplicate-id"](error.id) : texts.invalid;
			default: {
				const fixed = (texts as unknown as Record<string, unknown>)[error.code];
				return typeof fixed === "string" ? fixed : texts.invalid;
			}
		}
	}

	private static problemOf(m: Messages, code: string): string | null {
		const known = (m.problems as Record<string, string>)[code];
		return typeof known === "string" ? known : null;
	}
}
