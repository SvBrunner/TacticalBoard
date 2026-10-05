import type { ApiClient } from "$lib/api/ApiClient";
import type { Area, AreaDto } from "./Area";

/** A folder of an area, as the server returns it (arc42 ch. 8.15). */
export interface Folder {
	readonly id: string;
	readonly name: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	/** The area it lives in (the personal area or a team's). */
	readonly area: AreaDto;
	/** Whether the current user may change it — rename, delete, put situations into it (false for a team Reader, arc42 ch. 8.1). */
	readonly canWrite: boolean;
}

/** A folder in the list of an area's folders: with the number of (non-deleted) situations in it. */
export interface FolderSummary extends Folder {
	readonly situationCount: number;
}

/** The server's REST API for folders (arc42 ch. 8.15). */
export class FolderApi {
	static readonly PERSONAL_AREA_PATH = "/api/personal-area/folders";
	static readonly DUPLICATE_NAME = "https://tacticalboard/errors/duplicate-folder-name";
	static readonly NOT_EMPTY = "https://tacticalboard/errors/folder-not-empty";
	static readonly NOT_FOUND = "https://tacticalboard/errors/folder-not-found";

	/** Same limit as the backend (UTF-16 code units, like `maxlength`; confirmed product decision: 64). */
	static readonly MAX_NAME_LENGTH = 64;

	constructor(private readonly api: ApiClient) {}

	static folderPath(id: string): string {
		return `/api/folders/${encodeURIComponent(id)}`;
	}

	/** The folders of `area`: the personal area's, or a team's (`/api/teams/<id>/folders`). */
	static areaPath(area: Area): string {
		return area.kind === "team" ? `/api/teams/${encodeURIComponent(area.teamId)}/folders` : FolderApi.PERSONAL_AREA_PATH;
	}

	/** The folders of `area`, by name, each with the number of situations in it. */
	list(area: Area): Promise<FolderSummary[]> {
		return this.api.get<FolderSummary[]>(FolderApi.areaPath(area));
	}

	/** One folder. */
	get(id: string): Promise<Folder> {
		return this.api.get<Folder>(FolderApi.folderPath(id));
	}

	/** Creates a folder in `area`; a `409` (duplicate-folder-name) when the name is taken, a `403` without the right. */
	create(area: Area, name: string): Promise<Folder> {
		return this.api.send<Folder>("POST", FolderApi.areaPath(area), { name });
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
