import type { ApiClient } from "$lib/api/ApiClient";
import type { AreaDto } from "./Area";
import { FolderApi } from "./FolderApi";
import type { SaveTarget } from "./SaveTarget";

/** Who created or changed a saved situation; `displayName` is `null` for a deleted user. */
export interface UserReference {
	readonly id: string;
	readonly displayName: string | null;
}

/** A saved situation's metadata, as the server lists it (arc42 ch. 8.15). */
export interface SituationSummary {
	readonly id: string;
	readonly title: string;
	readonly sport: string;
	readonly fieldType: string;
	/** The folder of the area it is in, or `null` for the top level. */
	readonly folderId: string | null;
	/** The current revision, the concurrency token of the next save. */
	readonly revision: number;
	readonly createdAt: string;
	readonly createdBy: UserReference;
	readonly updatedAt: string;
	readonly updatedBy: UserReference;
	/** The area it lives in (the personal area or a team's). */
	readonly area: AreaDto;
	/**
	 * Whether the current user may change it — save, move, delete (arc42 ch.
	 * 8.1: false for a team Reader). As of this answer; the server checks again.
	 */
	readonly canWrite: boolean;
}

/** A saved situation with its current document (the situation file format, ch. 8.3). */
export interface StoredSituation extends SituationSummary {
	readonly document: unknown;
}

/**
 * Where a situation saved for the first time comes from; the server decides
 * with it what a taken title means (an error, or the next free number).
 */
export type SituationOrigin = "new" | "imported" | "copy";

/** Extra information for a first save. */
export interface CreateOptions {
	/**
	 * The title is a default title (in any UI language, arc42 ch. 8.18): a
	 * taken one gets the next free number instead of being refused.
	 */
	readonly titleIsDefault?: boolean;
}

/** The server's REST API for saved situations (arc42 ch. 8.15). */
export class SituationApi {
	static readonly PERSONAL_AREA_PATH = "/api/personal-area/situations";
	static readonly DUPLICATE_TITLE = "https://tacticalboard/errors/duplicate-title";
	static readonly SAVE_CONFLICT = "https://tacticalboard/errors/save-conflict";
	static readonly NOT_FOUND = "https://tacticalboard/errors/situation-not-found";

	constructor(private readonly api: ApiClient) {}

	static situationPath(id: string): string {
		return `/api/situations/${encodeURIComponent(id)}`;
	}

	/** The `If-Match` / `ETag` value of a revision. */
	static revisionTag(revision: number): string {
		return `"${revision}"`;
	}

	/** The situations of a folder: its own collection path. */
	static folderSituationsPath(folderId: string): string {
		return `${FolderApi.folderPath(folderId)}/situations`;
	}

	/** The situations at the top level of a team's area. */
	static teamSituationsPath(teamId: string): string {
		return `/api/teams/${encodeURIComponent(teamId)}/situations`;
	}

	/** Where a first save into `target` goes: a folder (of any area), or the top level of the personal area or of a team. */
	static collectionPath(target: SaveTarget): string {
		if (target.folderId !== null) {
			return SituationApi.folderSituationsPath(target.folderId);
		}
		return target.area.kind === "team" ? SituationApi.teamSituationsPath(target.area.teamId) : SituationApi.PERSONAL_AREA_PATH;
	}

	/** The saved situations at `target` (metadata only): the top level of an area, or a folder. */
	list(target: SaveTarget): Promise<SituationSummary[]> {
		return this.api.get<SituationSummary[]>(SituationApi.collectionPath(target));
	}

	/** One saved situation with its document. */
	get(id: string): Promise<StoredSituation> {
		return this.api.get<StoredSituation>(SituationApi.situationPath(id));
	}

	/** The first save: creates the situation at `target` (the top level of an area, or a folder). */
	create(document: unknown, origin: SituationOrigin, target: SaveTarget, options: CreateOptions = {}): Promise<StoredSituation> {
		const body = options.titleIsDefault ? { document, origin, titleIsDefault: true } : { document, origin };
		return this.api.send<StoredSituation>("POST", SituationApi.collectionPath(target), body);
	}

	/** A later save on top of `revision`; a `412` (save-conflict) when someone else saved in between. */
	update(id: string, revision: number, document: unknown): Promise<StoredSituation> {
		return this.api.send<StoredSituation>("PUT", SituationApi.situationPath(id), { document }, {
			"If-Match": SituationApi.revisionTag(revision),
		});
	}

	/**
	 * Moves the situation into a folder of its area, or to the top level
	 * (`null`). Not a save: no new revision, no `If-Match` (arc42 ch. 8.15).
	 */
	move(id: string, folderId: string | null): Promise<SituationSummary> {
		return this.api.send<SituationSummary>("PUT", `${SituationApi.situationPath(id)}/folder`, { folderId });
	}

	/** Deletes the situation (on the server a soft delete). */
	delete(id: string): Promise<void> {
		return this.api.send<void>("DELETE", SituationApi.situationPath(id));
	}
}
