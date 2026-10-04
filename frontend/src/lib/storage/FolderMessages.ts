import { ApiError } from "$lib/api/ApiClient";
import type { Translatable } from "$lib/i18n/Messages";
import { ProblemText } from "$lib/i18n/ProblemText";
import { FolderApi } from "./FolderApi";

/** The outcome of creating or renaming a folder: the folder, or a message for the user. */
export type FolderChange<T> = { readonly ok: true; readonly folder: T } | { readonly ok: false; readonly message: Translatable };

/** The outcome of deleting a folder. */
export type FolderDeletion = { readonly ok: true } | { readonly ok: false; readonly message: Translatable };

/** What the user is told when a folder request fails (arc42 ch. 8.2 problem codes, worded in ch. 8.18). */
export class FolderMessages {
	static readonly MISSING: Translatable = (m) => m.folders.missing;

	/** Why a folder can't be deleted while it still contains situations (arc42 ch. 1); `name` while it is known. */
	static notEmpty(name: string | null): Translatable {
		return (m) => m.folders.notEmpty(name);
	}

	/** The message for a failed create or rename of a folder named `name`. */
	static forNameChange(error: unknown, name: string, fallback: Translatable): Translatable {
		if (error instanceof ApiError) {
			if (error.type === FolderApi.DUPLICATE_NAME) {
				return (m) => m.folders.duplicate(name);
			}
			if (error.type === FolderApi.NOT_FOUND) {
				return FolderMessages.MISSING;
			}
			const invalid = ProblemText.fieldError(error, "name");
			if (invalid) {
				return (m) => m.folders.invalidName(invalid(m));
			}
		}
		return FolderMessages.general(error, fallback);
	}

	/** The message for any other failure. */
	static general(error: unknown, fallback: Translatable): Translatable {
		return ProblemText.describe(error, fallback);
	}

	/** Whether the server said the session has ended. */
	static isSessionEnded(error: unknown): boolean {
		return ProblemText.isSessionEnded(error);
	}
}
