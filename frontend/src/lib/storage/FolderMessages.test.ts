import { describe, it, expect } from "vitest";
import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { FolderApi } from "./FolderApi";
import { FolderMessages } from "./FolderMessages";

describe("FolderMessages", () => {
	it("explains why a folder with situations can't be deleted", () => {
		expect(FolderMessages.notEmpty("Set pieces")).toBe(
			"“Set pieces” can't be deleted because it still contains situations. Move or delete them first.",
		);
		expect(FolderMessages.notEmpty(null)).toBe("The folder can't be deleted because it still contains situations. Move or delete them first.");
		expect(FolderMessages.subject("A")).toBe("“A”");
	});

	it.each<[string, unknown, string]>([
		["a taken name", new ApiError(409, { type: FolderApi.DUPLICATE_NAME }), "A folder named “Set pieces” already exists. Choose another name."],
		["a deleted folder", new ApiError(404, { type: FolderApi.NOT_FOUND }), "This folder no longer exists."],
		["an invalid name", new ApiError(400, { errors: { name: ["must not be empty"] } }), "The name must not be empty."],
		["no server", new ApiUnavailableError(), "The server is not reachable. Please try again later."],
		["an ended session", new ApiError(401, {}), "Your session has ended. Please log in again."],
		["anything else", new ApiError(500, {}), "Fallback."],
		["a non-API error", new Error("boom"), "Fallback."],
	])("words a failed name change: %s", (_name, error, message) => {
		expect(FolderMessages.forNameChange(error, "Set pieces", "Fallback.")).toBe(message);
	});

	it("words other failures", () => {
		expect(FolderMessages.general(new ApiUnavailableError(), "Fallback.")).toBe(FolderMessages.UNAVAILABLE);
		expect(FolderMessages.general(new ApiError(401, {}), "Fallback.")).toBe(FolderMessages.SESSION_ENDED);
		expect(FolderMessages.general(new ApiError(409, { type: FolderApi.DUPLICATE_NAME }), "Fallback.")).toBe("Fallback.");
	});

	it("recognizes an ended session", () => {
		expect(FolderMessages.isSessionEnded(new ApiError(401, {}))).toBe(true);
		expect(FolderMessages.isSessionEnded(new ApiError(403, {}))).toBe(false);
		expect(FolderMessages.isSessionEnded(new Error("x"))).toBe(false);
	});
});
