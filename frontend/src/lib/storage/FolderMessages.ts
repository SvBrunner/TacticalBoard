import { ApiError, ApiUnavailableError } from "$lib/api/ApiClient";
import { FolderApi } from "./FolderApi";

/** The outcome of creating or renaming a folder: the folder, or a message for the user. */
export type FolderChange<T> = { readonly ok: true; readonly folder: T } | { readonly ok: false; readonly message: string };

/** The outcome of deleting a folder. */
export type FolderDeletion = { readonly ok: true } | { readonly ok: false; readonly message: string };

/** What the user is told when a folder request fails (arc42 ch. 8.2 problem types). */
export class FolderMessages {
	static readonly UNAVAILABLE = "The server is not reachable. Please try again later.";
	static readonly SESSION_ENDED = "Your session has ended. Please log in again.";
	static readonly MISSING = "This folder no longer exists.";

	/** Why a folder can't be deleted while it still contains situations (arc42 ch. 1). */
	static notEmpty(name: string | null): string {
		return `${FolderMessages.subject(name)} can't be deleted because it still contains situations. Move or delete them first.`;
	}

	/** The folder as the subject of a message: “its name”, or "The folder" while it isn't known. */
	static subject(name: string | null): string {
		return name === null ? "The folder" : `“${name}”`;
	}

	/** The message for a failed create or rename of a folder named `name`. */
	static forNameChange(error: unknown, name: string, fallback: string): string {
		if (error instanceof ApiError) {
			if (error.type === FolderApi.DUPLICATE_NAME) {
				return `A folder named “${name}” already exists. Choose another name.`;
			}
			if (error.type === FolderApi.NOT_FOUND) {
				return FolderMessages.MISSING;
			}
			const invalid = error.fieldError("name");
			if (invalid) {
				return `The name ${invalid}.`;
			}
		}
		return FolderMessages.general(error, fallback);
	}

	/** The message for any other failure. */
	static general(error: unknown, fallback: string): string {
		if (error instanceof ApiUnavailableError) {
			return FolderMessages.UNAVAILABLE;
		}
		if (error instanceof ApiError && error.status === 401) {
			return FolderMessages.SESSION_ENDED;
		}
		return fallback;
	}

	/** Whether the server said the session has ended. */
	static isSessionEnded(error: unknown): boolean {
		return error instanceof ApiError && error.status === 401;
	}
}
