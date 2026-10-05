/**
 * An area where saved situations and folders live (arc42 ch. 5.2, 8.15, glossary
 * "Area"): the current user's personal area, or a team's.
 */
export type Area = { readonly kind: "personal" } | { readonly kind: "team"; readonly teamId: string };

/** An area as the server names it on folders and situations: `{ kind, id }` — the owner's id (the user, or the team). */
export interface AreaDto {
	readonly kind: "personal" | "team";
	readonly id: string;
}

/** The current user's personal area. */
export const PERSONAL_AREA: Area = Object.freeze({ kind: "personal" });

/** The area of the team `teamId`. */
export function teamArea(teamId: string): Area {
	return { kind: "team", teamId };
}

/** The area the server named (a personal area is always the current user's own, ch. 8.1). */
export function areaOf(dto: AreaDto): Area {
	return dto.kind === "team" ? teamArea(dto.id) : PERSONAL_AREA;
}

/** Whether `a` and `b` are the same area. */
export function sameArea(a: Area, b: Area): boolean {
	return a.kind === "team" ? b.kind === "team" && a.teamId === b.teamId : b.kind === "personal";
}
