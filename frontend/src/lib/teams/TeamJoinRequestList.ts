import { get, writable, type Readable } from "svelte/store";
import { inEnglish } from "$lib/i18n";
import type { Translatable } from "$lib/i18n/Messages";
import type { JoinRequest, TeamMember } from "./TeamApi";
import { TeamMessages, type MembershipOutcome } from "./TeamMessages";

/** The state of a team's pending join requests. */
export type TeamJoinRequestListState =
	| { readonly status: "loading" }
	| { readonly status: "loaded"; readonly requests: readonly JoinRequest[] }
	| { readonly status: "failed"; readonly message: Translatable };

export interface TeamJoinRequestListDependencies {
	readonly api: {
		joinRequests(team: string): Promise<JoinRequest[]>;
		acceptJoinRequest(team: string, requestId: string): Promise<TeamMember>;
		rejectJoinRequest(team: string, requestId: string): Promise<void>;
	};
	/** The team's code or id. */
	readonly key: string;
	/** A request was accepted or rejected (the member list and the team's count change). */
	readonly onDecided?: () => void;
	/** The server said the user may not do this (any more): the page loads the team again. */
	readonly onAccessLost?: () => void;
	readonly onSessionEnded?: () => void;
	readonly log?: {
		notify(message: string, level?: "info" | "warn" | "error"): void;
	};
}

/**
 * The pending join requests of a team, for its Admins (arc42 ch. 8.17):
 * oldest first; accepting makes the user a Reader, rejecting lets them ask
 * again. A request another Admin decided meanwhile is gone from the list
 * afterwards, with a message.
 */
export class TeamJoinRequestList {
	private readonly store = writable<TeamJoinRequestListState>({ status: "loading" });

	readonly state: Readable<TeamJoinRequestListState> = {
		subscribe: this.store.subscribe,
	};

	constructor(private readonly deps: TeamJoinRequestListDependencies) {}

	current(): TeamJoinRequestListState {
		return get(this.store);
	}

	/** The loaded requests, or none. */
	requests(): readonly JoinRequest[] {
		const state = this.current();
		return state.status === "loaded" ? state.requests : [];
	}

	/** Loads the list; `quietly` keeps showing the current one meanwhile. Never throws. */
	async load(quietly = false): Promise<void> {
		if (!quietly || this.current().status !== "loaded") {
			this.store.set({ status: "loading" });
		}
		try {
			this.store.set({ status: "loaded", requests: await this.deps.api.joinRequests(this.deps.key) });
		} catch (error) {
			this.store.set({
				status: "failed",
				message: this.failure(error, TeamMessages.general(error, (m) => m.joinRequests.loadFailed)),
			});
		}
	}

	/** Accepts `request`: its user becomes a Reader. Never throws. */
	async accept(request: JoinRequest, teamName: string): Promise<MembershipOutcome<TeamMember>> {
		try {
			const member = await this.deps.api.acceptJoinRequest(this.deps.key, request.id);
			this.decided(request, "Accepted");
			return { ok: true, value: member };
		} catch (error) {
			return this.refused(error, teamName, (m) => m.joinRequests.acceptFailed);
		}
	}

	/** Rejects `request`; its user may ask again. Never throws. */
	async reject(request: JoinRequest, teamName: string): Promise<MembershipOutcome<JoinRequest>> {
		try {
			await this.deps.api.rejectJoinRequest(this.deps.key, request.id);
			this.decided(request, "Rejected");
			return { ok: true, value: request };
		} catch (error) {
			return this.refused(error, teamName, (m) => m.joinRequests.rejectFailed);
		}
	}

	private decided(request: JoinRequest, how: string): void {
		this.store.set({ status: "loaded", requests: this.requests().filter((candidate) => candidate.id !== request.id) });
		this.log(`${how} the join request ${request.id} of team ${this.deps.key}`);
		this.deps.onDecided?.();
	}

	private refused(error: unknown, teamName: string, fallback: Translatable): { readonly ok: false; readonly message: Translatable } {
		if (TeamMessages.isAccessLost(error)) {
			this.deps.onAccessLost?.();
		} else {
			// Another Admin may have decided it meanwhile.
			void this.load(true);
			this.deps.onDecided?.();
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
