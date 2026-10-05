import { get, writable, type Readable } from "svelte/store";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import type { ConfirmationRequest } from "$lib/dialogs/ConfirmationPrompt";
import { TEAM_ROLES, type TeamMember, type TeamRole } from "./TeamApi";
import { TeamMessages, type MembershipOutcome } from "./TeamMessages";

/** The state of a team's member list. */
export type TeamMemberListState =
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly members: readonly TeamMember[] }
	| { readonly status: "failed"; readonly message: Translatable };

export interface TeamMemberListDependencies {
	readonly api: {
		members(team: string): Promise<TeamMember[]>;
		changeRole(team: string, userId: string, role: TeamRole): Promise<TeamMember>;
		removeMember(team: string, userId: string): Promise<void>;
	};
	/** The team's code or id. */
	readonly key: string;
	/** The server said the user may not do this (any more), e.g. they were removed or demoted meanwhile: the page loads the team again. */
	readonly onAccessLost?: () => void;
	readonly onSessionEnded?: () => void;
	/** The logged-in user: giving themselves a lower role asks first (`confirm`). */
	readonly currentUserId?: () => string;
	/** Asks a yes/no question, e.g. through `ConfirmationPrompt`; without it nothing is asked. */
	readonly confirm?: (request: ConfirmationRequest) => Promise<boolean>;
	readonly log?: {
		notify(message: string, level?: "info" | "warn" | "error"): void;
	};
}

/**
 * A team's member list on its page (arc42 ch. 8.17): every member sees it
 * (display name and role, in the server's order: Admins, Editors, Readers,
 * each by name); the team's Admins change roles (their own included; giving
 * themselves a lower role asks first — confirmed product decision) and remove
 * members. The server keeps at least one Admin; its refusal is worded with
 * the team's name.
 */
export class TeamMemberList {
	private readonly store = writable<TeamMemberListState>({ status: "loading" });

	readonly state: Readable<TeamMemberListState> = {
		subscribe: this.store.subscribe,
	};

	constructor(private readonly deps: TeamMemberListDependencies) {}

	current(): TeamMemberListState {
		return get(this.store);
	}

	/** The loaded members, or none. */
	members(): readonly TeamMember[] {
		const state = this.current();
		return state.status === "loaded" ? state.members : [];
	}

	/** Loads the list; `quietly` keeps showing the current one meanwhile. Never throws. */
	async load(quietly = false): Promise<void> {
		if (!quietly || this.current().status !== "loaded") {
			this.store.set({ status: "loading" });
		}
		try {
			this.store.set({ status: "loaded", members: await this.deps.api.members(this.deps.key) });
		} catch (error) {
			this.store.set({
				status: "failed",
				message: this.failure(error, TeamMessages.general(error, (m) => m.teamMembers.loadFailed)),
			});
		}
	}

	/** Whether `to` is a lower role than `from` (Admin > Editor > Reader). */
	static isDemotion(from: TeamRole, to: TeamRole): boolean {
		return TEAM_ROLES.indexOf(to) > TEAM_ROLES.indexOf(from);
	}

	/**
	 * Gives `member` the role `role` in the team named `teamName`; the list
	 * then loads again quietly, so it keeps the server's order by role. A user
	 * giving themselves a lower role is asked first; `null` when they cancel.
	 * Never throws.
	 */
	async changeRole(member: TeamMember, role: TeamRole, teamName: string): Promise<MembershipOutcome<TeamMember> | null> {
		if (!(await this.confirmOwnDemotion(member, role, teamName))) {
			return null;
		}
		try {
			const changed = await this.deps.api.changeRole(this.deps.key, member.userId, role);
			this.replace(changed);
			void this.load(true);
			this.log(`Changed the role of ${member.userId} in team ${this.deps.key} to ${role}`);
			return { ok: true, value: changed };
		} catch (error) {
			return this.refused(error, teamName, (m) => m.teamMembers.changeFailed);
		}
	}

	/** Removes `member` from the team named `teamName`. Never throws. */
	async remove(member: TeamMember, teamName: string): Promise<MembershipOutcome<TeamMember>> {
		try {
			await this.deps.api.removeMember(this.deps.key, member.userId);
			this.store.set({ status: "loaded", members: this.members().filter((candidate) => candidate.userId !== member.userId) });
			this.log(`Removed ${member.userId} from team ${this.deps.key}`);
			return { ok: true, value: member };
		} catch (error) {
			return this.refused(error, teamName, (m) => m.teamMembers.removeFailed);
		}
	}

	private async confirmOwnDemotion(member: TeamMember, role: TeamRole, teamName: string): Promise<boolean> {
		const own = this.deps.currentUserId?.() === member.userId;
		if (!own || !TeamMemberList.isDemotion(member.role, role) || !this.deps.confirm) {
			return true;
		}
		return this.deps.confirm({
			title: (m) => m.teamMembers.demoteSelfQuestion,
			message: (m) => m.teamMembers.demoteSelfMessage(teamName, m.teams.roles[role]),
			confirmLabel: (m) => m.teamMembers.demoteSelfConfirm,
			cancelLabel: (m) => m.common.cancel,
		});
	}

	private replace(changed: TeamMember): void {
		this.store.set({
			status: "loaded",
			members: this.members().map((candidate) => (candidate.userId === changed.userId ? changed : candidate)),
		});
	}

	private refused(error: unknown, teamName: string, fallback: Translatable): MembershipOutcome<TeamMember> {
		if (TeamMessages.isAccessLost(error)) {
			this.deps.onAccessLost?.();
		} else {
			// The list may be out of date (e.g. the member left meanwhile).
			void this.load(true);
		}
		return { ok: false, message: this.failure(error, TeamMessages.forMembership(error, teamName, "change", fallback)) };
	}

	private failure(error: unknown, message: Translatable): Translatable {
		if (TeamMessages.isSessionEnded(error)) {
			this.deps.onSessionEnded?.();
		}
		this.log(inEnglish(message), "error");
		return message;
	}

	private log(message: string, level: "info" | "error" = "info"): void {
		this.deps.log?.notify(message, level);
	}
}
