/**
 * The URLs of the team pages (arc42 ch. 8.8): the overview `/teams` and a
 * team's page `/teams/<CODE>` (deep-linkable; the link to share).
 */
export class TeamRoute {
	static readonly OVERVIEW = "/teams";

	/** The page of the team with `code`. */
	static forTeam(code: string): string {
		return `${TeamRoute.OVERVIEW}/${encodeURIComponent(code)}`;
	}

	/** The full link to a team's page, to share (`origin` e.g. `https://tacticalboard.example.org`). */
	static linkTo(code: string, origin: string): string {
		return `${origin}${TeamRoute.forTeam(code)}`;
	}
}
