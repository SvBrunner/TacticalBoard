import { PERSONAL_AREA, teamArea, type Area } from "./Area";

/**
 * Where a new or imported situation is saved on its first save (arc42 ch. 8.15:
 * "where it was started"): an area — the personal area or a team's — and a
 * folder of it, or its top level (`folderId: null`).
 */
export interface SaveTarget {
	readonly area: Area;
	readonly folderId: string | null;
}

/** The top level of the personal area: where situations started on the start page (or in local mode) are saved. */
export const TOP_LEVEL: SaveTarget = Object.freeze({ area: PERSONAL_AREA, folderId: null });

/** A folder of `area` (default: the personal area). */
export function inFolder(folderId: string, area: Area = PERSONAL_AREA): SaveTarget {
	return { area, folderId };
}

/** The top level of the team `teamId`'s area. */
export function teamTopLevel(teamId: string): SaveTarget {
	return { area: teamArea(teamId), folderId: null };
}
