import { describe, it, expect } from "vitest";
import { ApiError, ApiUnavailableError, type FieldErrorCode } from "$lib/api/ApiClient";
import { de, en } from "$lib/testing/i18n";
import { TeamApi } from "./TeamApi";
import { TeamMessages } from "./TeamMessages";

const fallback = () => "Fallback.";
const validation = (fieldErrors: Record<string, FieldErrorCode[]>) =>
	new ApiError(400, {
		type: "https://tacticalboard/errors/validation-failed",
		fieldErrors,
	});

describe("TeamMessages", () => {
	it("words a taken name with the name", () => {
		const error = new ApiError(409, { type: TeamApi.DUPLICATE_NAME });

		expect(TeamMessages.forChange(error, "Lions", fallback)(en)).toBe("A team named “Lions” already exists. Choose another name.");
		expect(TeamMessages.forChange(error, "Lions", fallback)(de)).toBe("Ein Team namens „Lions“ existiert bereits. Wähle einen anderen Namen.");
	});

	it("words a team that is gone", () => {
		const error = new ApiError(404, { type: TeamApi.NOT_FOUND });

		expect(TeamMessages.forChange(error, "Lions", fallback)(en)).toBe("This team no longer exists.");
		expect(TeamMessages.forLogo(error, fallback)(en)).toBe("This team no longer exists.");
	});

	it("words the name's and the logo's problems as sentences", () => {
		const error = validation({
			name: [{ code: "too-long", maxLength: 64 }],
			logo: [{ code: "unsupported-image" }],
		});

		expect(TeamMessages.forChange(error, "x", fallback)(en)).toBe("The name must be at most 64 characters long. The logo must be a PNG, JPEG or WebP image.");
		expect(TeamMessages.forLogo(validation({ logo: [{ code: "file-too-large", maxBytes: 5242880 }] }), fallback)(de)).toBe(
			"Das Logo darf höchstens 5 MB groß sein.",
		);
	});

	it("falls back to the general wording", () => {
		expect(TeamMessages.forChange(new ApiUnavailableError(), "x", fallback)(en)).toBe("The server is not reachable. Please try again later.");
		expect(TeamMessages.forChange(new ApiError(500, {}), "x", fallback)(en)).toBe("Fallback.");
		expect(TeamMessages.forLogo(new ApiError(403, { type: "https://tacticalboard/errors/forbidden" }), fallback)(en)).toBe("You may not do this.");
		expect(TeamMessages.general(new TypeError("x"), fallback)(en)).toBe("Fallback.");
	});

	it("knows an ended session", () => {
		expect(TeamMessages.isSessionEnded(new ApiError(401, null))).toBe(true);
		expect(TeamMessages.isSessionEnded(new ApiError(403, null))).toBe(false);
	});
});
