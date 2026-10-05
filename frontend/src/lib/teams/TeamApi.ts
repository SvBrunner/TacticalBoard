import type { ApiClient } from "$lib/api/ApiClient";

/** A member's role in a team (arc42 ch. 8.1), as the server names it. */
export type TeamRole = "admin" | "editor" | "reader";

/** The roles in the order they are offered (arc42 ch. 8.1). */
export const TEAM_ROLES: readonly TeamRole[] = ["admin", "editor", "reader"];

/**
 * Whether a member with `role` may change the team's situations and folders
 * (arc42 ch. 8.1: Admins and Editors, not Readers). The UI only hides what
 * isn't allowed; the server decides.
 */
export function canWriteContent(role: TeamRole | null): boolean {
	return role === "admin" || role === "editor";
}

/**
 * A team in a list (the overview): name and logo; the code only of the
 * user's own teams (`null` otherwise; non-members never get a team's code).
 */
export interface TeamSummary {
	readonly id: string;
	readonly code: string | null;
	readonly name: string;
	/** The logo's URL (it changes with the logo), or `null` without a logo. */
	readonly logoUrl: string | null;
}

/**
 * A team as its page shows it: `role` is the current user's role, `null`
 * for a non-member (who gets no `code` either); `joinRequestPending`: the
 * current user asked to join and waits; `pendingJoinRequests`: how many
 * requests wait, for the team's Admins only (`null` otherwise).
 */
export interface Team extends TeamSummary {
	readonly createdAt: string;
	readonly role: TeamRole | null;
	readonly joinRequestPending: boolean;
	readonly pendingJoinRequests: number | null;
}

/** A team of the current user, with their role and, for its Admins, the number of pending join requests. */
export interface MyTeam extends TeamSummary {
	readonly code: string;
	readonly role: TeamRole;
	readonly pendingJoinRequests: number | null;
}

/** A member of a team: `displayName` is `null` for a deleted user. */
export interface TeamMember {
	readonly userId: string;
	readonly displayName: string | null;
	readonly role: TeamRole;
	readonly joinedAt: string;
}

/** A pending request to join a team. */
export interface JoinRequest {
	readonly id: string;
	readonly user: { readonly id: string; readonly displayName: string | null };
	readonly requestedAt: string;
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
	static readonly FORBIDDEN = "https://tacticalboard/errors/forbidden";
	static readonly LAST_ADMIN = "https://tacticalboard/errors/last-team-admin";
	static readonly MEMBER_NOT_FOUND = "https://tacticalboard/errors/team-member-not-found";
	static readonly JOIN_REQUEST_NOT_FOUND = "https://tacticalboard/errors/join-request-not-found";
	static readonly JOIN_REQUEST_PENDING = "https://tacticalboard/errors/join-request-pending";
	static readonly ALREADY_MEMBER = "https://tacticalboard/errors/already-team-member";

	/** Same limit as the backend (UTF-16 code units, like `maxlength`; 64 like folder names). */
	static readonly MAX_NAME_LENGTH = 64;
	/** The largest logo upload the backend accepts: 5 MiB. */
	static readonly MAX_LOGO_BYTES = 5 * 1024 * 1024;
	/** The image types the backend accepts as a logo. */
	static readonly LOGO_TYPES: readonly string[] = ["image/png", "image/jpeg", "image/webp"];
	/** How many teams the overview loads at a time. */
	static readonly PAGE_SIZE = 50;

	constructor(private readonly api: ApiClient) {}

	/** A team's path; `team` is its code or its id (the server takes both). */
	static teamPath(team: string): string {
		return `${TeamApi.TEAMS_PATH}/${encodeURIComponent(team)}`;
	}

	static logoPath(team: string): string {
		return `${TeamApi.teamPath(team)}/logo`;
	}

	static membersPath(team: string): string {
		return `${TeamApi.teamPath(team)}/members`;
	}

	static memberPath(team: string, userId: string): string {
		return `${TeamApi.membersPath(team)}/${encodeURIComponent(userId)}`;
	}

	static joinRequestsPath(team: string): string {
		return `${TeamApi.teamPath(team)}/join-requests`;
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

	/** One team by its code or id. */
	get(team: string): Promise<Team> {
		return this.api.get<Team>(TeamApi.teamPath(team));
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
	rename(team: string, name: string): Promise<Team> {
		return this.api.send<Team>("PUT", TeamApi.teamPath(team), { name });
	}

	/** Deletes a team with everything in it (Admins). */
	delete(team: string): Promise<void> {
		return this.api.send<void>("DELETE", TeamApi.teamPath(team));
	}

	/** Sets or replaces the team's logo (Admins). */
	setLogo(team: string, logo: File): Promise<Team> {
		const form = new FormData();
		form.append("logo", logo, logo.name);
		return this.api.sendForm<Team>("PUT", TeamApi.logoPath(team), form);
	}

	/** Removes the team's logo (Admins). */
	removeLogo(team: string): Promise<void> {
		return this.api.send<void>("DELETE", TeamApi.logoPath(team));
	}

	/** The team's members, by name (members only). */
	members(team: string): Promise<TeamMember[]> {
		return this.api.get<TeamMember[]>(TeamApi.membersPath(team));
	}

	/** Gives a member another role (Admins). */
	changeRole(team: string, userId: string, role: TeamRole): Promise<TeamMember> {
		return this.api.send<TeamMember>("PUT", `${TeamApi.memberPath(team, userId)}/role`, { role });
	}

	/** Removes a member (Admins). */
	removeMember(team: string, userId: string): Promise<void> {
		return this.api.send<void>("DELETE", TeamApi.memberPath(team, userId));
	}

	/** The current user leaves the team. */
	leave(team: string): Promise<void> {
		return this.api.send<void>("DELETE", `${TeamApi.membersPath(team)}/me`);
	}

	/** The current user asks to join the team. */
	requestToJoin(team: string): Promise<JoinRequest> {
		return this.api.send<JoinRequest>("POST", TeamApi.joinRequestsPath(team));
	}

	/** The team's pending join requests, oldest first (Admins). */
	joinRequests(team: string): Promise<JoinRequest[]> {
		return this.api.get<JoinRequest[]>(TeamApi.joinRequestsPath(team));
	}

	/** Accepts a join request: its user becomes a Reader (Admins). */
	acceptJoinRequest(team: string, requestId: string): Promise<TeamMember> {
		return this.api.send<TeamMember>("POST", `${TeamApi.joinRequestsPath(team)}/${encodeURIComponent(requestId)}/accept`);
	}

	/** Rejects a join request; its user may ask again (Admins). */
	rejectJoinRequest(team: string, requestId: string): Promise<void> {
		return this.api.send<void>("POST", `${TeamApi.joinRequestsPath(team)}/${encodeURIComponent(requestId)}/reject`);
	}
}
