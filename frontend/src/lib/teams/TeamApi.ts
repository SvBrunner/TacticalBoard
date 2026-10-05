import type { ApiClient } from "$lib/api/ApiClient";

/** A member's role in a team (arc42 ch. 8.1), as the server names it. */
export type TeamRole = "admin" | "editor" | "reader";

/** A team in a list (the overview): name, code, logo. */
export interface TeamSummary {
	readonly id: string;
	readonly code: string;
	readonly name: string;
	/** The logo's URL (it changes with the logo), or `null` without a logo. */
	readonly logoUrl: string | null;
}

/** A team as its page shows it: `role` is the current user's role, `null` for a non-member. */
export interface Team extends TeamSummary {
	readonly createdAt: string;
	readonly role: TeamRole | null;
}

/** A team of the current user, with their role. */
export interface MyTeam extends TeamSummary {
	readonly role: TeamRole;
}

/** One page of the team overview. */
export interface TeamSearchPage {
	readonly items: readonly TeamSummary[];
	/** How many teams match in total. */
	readonly total: number;
	readonly offset: number;
	readonly limit: number;
}

/** The server's REST API for teams (arc42 ch. 8.17). */
export class TeamApi {
	static readonly TEAMS_PATH = "/api/teams";
	static readonly MY_TEAMS_PATH = "/api/me/teams";
	static readonly DUPLICATE_NAME = "https://tacticalboard/errors/duplicate-team-name";
	static readonly NOT_FOUND = "https://tacticalboard/errors/team-not-found";

	/** Same limit as the backend (UTF-16 code units, like `maxlength`; 64 like folder names). */
	static readonly MAX_NAME_LENGTH = 64;
	/** The largest logo upload the backend accepts: 5 MiB. */
	static readonly MAX_LOGO_BYTES = 5 * 1024 * 1024;
	/** The image types the backend accepts as a logo. */
	static readonly LOGO_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];
	/** How many teams the overview loads at a time. */
	static readonly PAGE_SIZE = 50;

	constructor(private readonly api: ApiClient) {}

	static teamPath(code: string): string {
		return `${TeamApi.TEAMS_PATH}/${encodeURIComponent(code)}`;
	}

	static logoPath(code: string): string {
		return `${TeamApi.teamPath(code)}/logo`;
	}

	/** One page of all teams whose name or code contains `text` (ignoring case; all teams for an empty text). */
	search(text: string, offset = 0, limit = TeamApi.PAGE_SIZE): Promise<TeamSearchPage> {
		const query = new URLSearchParams();
		if (text.trim().length > 0) {
			query.set("search", text.trim());
		}
		query.set("offset", String(offset));
		query.set("limit", String(limit));
		return this.api.get<TeamSearchPage>(`${TeamApi.TEAMS_PATH}?${query.toString()}`);
	}

	/** The current user's teams with their role, by name. */
	listMine(): Promise<MyTeam[]> {
		return this.api.get<MyTeam[]>(TeamApi.MY_TEAMS_PATH);
	}

	/** One team by its code. */
	get(code: string): Promise<Team> {
		return this.api.get<Team>(TeamApi.teamPath(code));
	}

	/** Creates a team, optionally with a logo; the current user becomes its Admin. */
	create(name: string, logo: File | null): Promise<Team> {
		const form = new FormData();
		form.append("name", name);
		if (logo) {
			form.append("logo", logo, logo.name);
		}
		return this.api.sendForm<Team>("POST", TeamApi.TEAMS_PATH, form);
	}

	/** Renames a team (Admins). */
	rename(code: string, name: string): Promise<Team> {
		return this.api.send<Team>("PUT", TeamApi.teamPath(code), { name });
	}

	/** Sets or replaces the team's logo (Admins). */
	setLogo(code: string, logo: File): Promise<Team> {
		const form = new FormData();
		form.append("logo", logo, logo.name);
		return this.api.sendForm<Team>("PUT", TeamApi.logoPath(code), form);
	}

	/** Removes the team's logo (Admins). */
	removeLogo(code: string): Promise<void> {
		return this.api.send<void>("DELETE", TeamApi.logoPath(code));
	}
}
