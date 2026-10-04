import { describe, it, expect } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { de, en } from "$lib/testing/i18n";
import { FolderApi } from "./FolderApi";
import { FolderMessages } from "./FolderMessages";

const fallback = () => "Fallback.";

describe("FolderMessages", () => {
	it("explains why a folder with situations can't be deleted", () => {
		expect(FolderMessages.notEmpty("Set pieces")(en)).toBe(
			"“Set pieces” can't be deleted because it still contains situations. Move or delete them first.",
		);
		expect(FolderMessages.notEmpty(null)(en)).toBe(
			"The folder can't be deleted because it still contains situations. Move or delete them first.",
		);
		expect(FolderMessages.notEmpty("Set pieces")(de)).toBe(
			"„Set pieces“ kann nicht gelöscht werden, weil er noch Situationen enthält. Verschiebe oder lösche sie zuerst.",
		);
	});

	it.each<[string, unknown, string]>([
		["a taken name", new ApiError(409, { type: FolderApi.DUPLICATE_NAME }), "A folder named “Set pieces” already exists. Choose another name."],
		["a deleted folder", new ApiError(404, { type: FolderApi.NOT_FOUND }), "This folder no longer exists."],
		[
			"an invalid name (by its code)",
			new ApiError(400, { errors: { name: ["server text"] }, fieldErrors: { name: [{ code: "required" }] } }),
			"The name must not be empty.",
		],
		[
			"a too long name (by its code, with its value)",
			new ApiError(400, { fieldErrors: { name: [{ code: "too-long", maxLength: 100 }] } }),
			"The name must be at most 100 characters long.",
		],
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["anything else", new ApiError(500, {}), "Fallback."],
		["a non-API error", new Error("boom"), "Fallback."],
	])("words a failed name change: %s", (_name, error, message) => {
		expect(FolderMessages.forNameChange(error, "Set pieces", fallback)(en)).toBe(message);
	});

	it("words a failed name change in German", () => {
		expect(FolderMessages.forNameChange(new ApiError(409, { type: FolderApi.DUPLICATE_NAME }), "Set pieces", fallback)(de)).toBe(
			"Ein Ordner namens „Set pieces“ existiert bereits. Wähle einen anderen Namen.",
		);
		expect(
			FolderMessages.forNameChange(new ApiError(400, { fieldErrors: { name: [{ code: "control-characters" }] } }), "x", fallback)(de),
		).toBe("Der Name darf keine Steuerzeichen enthalten.");
	});

	it("words other failures: no server, an ended session, a known problem code, else the fallback", () => {
		expect(FolderMessages.general(new ApiUnavailableError(), fallback)(en)).toBe("The server is not reachable. Please try again later.");
		expect(FolderMessages.general(new ApiError(401, {}), fallback)(en)).toBe("Your session has ended. Please log in again.");
		expect(FolderMessages.general(new ApiError(409, { type: FolderApi.NOT_EMPTY }), fallback)(en)).toBe(
			"The folder still contains situations.",
		);
		expect(FolderMessages.general(new ApiError(409, { type: "https://tacticalboard/errors/unknown-thing" }), fallback)(en)).toBe("Fallback.");
	});

	it("recognizes an ended session", () => {
		expect(FolderMessages.isSessionEnded(new ApiError(401, {}))).toBe(true);
		expect(FolderMessages.isSessionEnded(new ApiError(403, {}))).toBe(false);
		expect(FolderMessages.isSessionEnded(new Error("x"))).toBe(false);
	});
});
