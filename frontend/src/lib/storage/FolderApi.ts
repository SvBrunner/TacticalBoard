import type { ApiClient } from "$lib/api/ApiClient";

/** A folder of an area, as the server returns it (arc42 ch. 8.15). */
export interface Folder {
	readonly id: string;
	readonly name: string;
	readonly createdAt: string;
	readonly updatedAt: string;
}

/** The server's REST API for folders (arc42 ch. 8.15). */
export class FolderApi {
	static readonly PERSONAL_AREA_PATH = "/api/personal-area/folders";
	static readonly DUPLICATE_NAME = "https://tacticalboard/errors/duplicate-folder-name";
	static readonly NOT_EMPTY = "https://tacticalboard/errors/folder-not-empty";
	static readonly NOT_FOUND = "https://tacticalboard/errors/folder-not-found";

	/** Same limit as the backend (UTF-16 code units, like `maxlength`). */
	static readonly MAX_NAME_LENGTH = 100;

	constructor(private readonly api: ApiClient) {}

	static folderPath(id: string): string {
		return `/api/folders/${encodeURIComponent(id)}`;
	}

	/** The current user's folders, by name. */
	listPersonal(): Promise<Folder[]> {
		return this.api.get<Folder[]>(FolderApi.PERSONAL_AREA_PATH);
	}

	/** One folder. */
	get(id: string): Promise<Folder> {
		return this.api.get<Folder>(FolderApi.folderPath(id));
	}

	/** Creates a folder in the personal area; a `409` (duplicate-folder-name) when the name is taken. */
	createPersonal(name: string): Promise<Folder> {
		return this.api.send<Folder>("POST", FolderApi.PERSONAL_AREA_PATH, { name });
	}

	/** Renames a folder; a `409` (duplicate-folder-name) when the name is taken. */
	rename(id: string, name: string): Promise<Folder> {
		return this.api.send<Folder>("PUT", FolderApi.folderPath(id), { name });
	}

	/** Deletes an empty folder (on the server a soft delete); a `409` (folder-not-empty) otherwise. */
	delete(id: string): Promise<void> {
		return this.api.send<void>("DELETE", FolderApi.folderPath(id));
	}
}
