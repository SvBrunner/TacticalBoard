import type { ApiClient } from "$lib/api/ApiClient";

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
	/** Reserved for folders (later); always `null` for now: the top level of the area. */
	readonly folderId: string | null;
	/** The current revision, the concurrency token of the next save. */
	readonly revision: number;
	readonly createdAt: string;
	readonly createdBy: UserReference;
	readonly updatedAt: string;
	readonly updatedBy: UserReference;
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

	/** The current user's saved situations (metadata only). */
	listPersonal(): Promise<SituationSummary[]> {
		return this.api.get<SituationSummary[]>(SituationApi.PERSONAL_AREA_PATH);
	}

	/** One saved situation with its document. */
	get(id: string): Promise<StoredSituation> {
		return this.api.get<StoredSituation>(SituationApi.situationPath(id));
	}

	/** The first save: creates the situation at the top level of the personal area. */
	create(document: unknown, origin: SituationOrigin): Promise<StoredSituation> {
		return this.api.send<StoredSituation>("POST", SituationApi.PERSONAL_AREA_PATH, { document, origin });
	}

	/** A later save on top of `revision`; a `412` (save-conflict) when someone else saved in between. */
	update(id: string, revision: number, document: unknown): Promise<StoredSituation> {
		return this.api.send<StoredSituation>("PUT", SituationApi.situationPath(id), { document }, {
			"If-Match": SituationApi.revisionTag(revision),
		});
	}

	/** Deletes the situation (on the server a soft delete). */
	delete(id: string): Promise<void> {
		return this.api.send<void>("DELETE", SituationApi.situationPath(id));
	}
}
