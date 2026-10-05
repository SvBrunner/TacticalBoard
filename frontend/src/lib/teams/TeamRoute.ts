/**
 * The URLs of the team pages (arc42 ch. 8.8): the overview `/teams` and a
 * team's page `/teams/<CODE>` (deep-linkable; the link to share). A team
 * whose code the user doesn't get (they are no member) is linked by its id,
 * `/teams/<id>` — the page and the server take both.
 */
export class TeamRoute {
	static readonly OVERVIEW = "/teams";

	/** The page of the team with `key`, its code or id. */
	static forTeam(key: string): string {
		return `${TeamRoute.OVERVIEW}/${encodeURIComponent(key)}`;
	}

	/** The page of `team`: by its code when the user has it, otherwise by its id. */
	static of(team: { readonly id: string; readonly code: string | null }): string {
		return TeamRoute.forTeam(team.code ?? team.id);
	}

	/** The full link to a team's page, to share (`origin` e.g. `https://tacticalboard.example.org`). */
	static linkTo(code: string, origin: string): string {
		return `${origin}${TeamRoute.forTeam(code)}`;
	}
}
