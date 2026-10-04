/**
 * Where a new or imported situation is saved on its first save (arc42 ch. 8.15:
 * "where it was started"): a folder of the personal area, or its top level
 * (`folderId: null`). Teams add their area later (roadmap Phase 2 step 8).
 */
export interface SaveTarget {
	readonly folderId: string | null;
}

/** The top level of the personal area: where situations started on the start page (or in the editor) are saved. */
export const TOP_LEVEL: SaveTarget = Object.freeze({ folderId: null });

/** A folder of the personal area. */
export function inFolder(folderId: string): SaveTarget {
	return { folderId };
}
