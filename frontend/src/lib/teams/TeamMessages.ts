import { ApiError } from "$lib/api/ApiClient";
import type { Translatable } from "$lib/i18n/Messages";
import { ProblemText } from "$lib/i18n/ProblemText";
import { TeamApi } from "./TeamApi";

/** The outcome of a change of a team: the result, or a message for the user. */
export type TeamChange<T> = { readonly ok: true; readonly team: T } | { readonly ok: false; readonly message: Translatable };

/** The outcome of a change of a team's members or join requests: the result, or a message for the user. */
export type MembershipOutcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: Translatable };

/** What the user tried when a membership request failed: it decides how "last Admin" is worded. */
export type MembershipAction = "leave" | "change";

/** What the user is told when a team request fails (arc42 ch. 8.2 problem codes, worded in ch. 8.18). */
export class TeamMessages {
	static readonly MISSING: Translatable = (m) => m.teams.missing;

	/**
	 * The message for a failed create or rename of a team named `name`
	 * (also its logo's problems, when one was sent along).
	 */
	static forChange(error: unknown, name: string, fallback: Translatable): Translatable {
		if (error instanceof ApiError) {
			if (error.type === TeamApi.DUPLICATE_NAME) {
				return (m) => m.teams.duplicate(name);
			}
			if (error.type === TeamApi.NOT_FOUND) {
				return TeamMessages.MISSING;
			}
			const parts = TeamMessages.fieldParts(error);
			if (parts.length > 0) {
				return (m) => parts.map((part) => part(m)).join(" ");
			}
		}
		return TeamMessages.general(error, fallback);
	}

	/** The message for a failed logo upload. */
	static forLogo(error: unknown, fallback: Translatable): Translatable {
		if (error instanceof ApiError) {
			if (error.type === TeamApi.NOT_FOUND) {
				return TeamMessages.MISSING;
			}
			const invalid = ProblemText.fieldError(error, "logo");
			if (invalid) {
				return (m) => m.teams.invalidLogo(invalid(m));
			}
		}
		return TeamMessages.general(error, fallback);
	}

	/**
	 * The message for a failed change of the members or join requests of
	 * the team named `teamName`: leaving, a role change, removing a member,
	 * asking to join, accepting or rejecting a request.
	 */
	static forMembership(error: unknown, teamName: string, action: MembershipAction, fallback: Translatable): Translatable {
		if (error instanceof ApiError) {
			switch (error.type) {
				case TeamApi.LAST_ADMIN:
					return action === "leave" ? (m) => m.teamMembers.lastAdminLeave(teamName) : (m) => m.teamMembers.lastAdmin(teamName);
				case TeamApi.MEMBER_NOT_FOUND:
					return (m) => m.teamMembers.memberGone;
				case TeamApi.JOIN_REQUEST_NOT_FOUND:
					return (m) => m.joinRequests.requestGone;
				case TeamApi.JOIN_REQUEST_PENDING:
					return (m) => m.joinRequests.alreadyPending;
				case TeamApi.ALREADY_MEMBER:
					return (m) => m.joinRequests.alreadyMember;
				case TeamApi.NOT_FOUND:
					return TeamMessages.MISSING;
			}
		}
		return TeamMessages.general(error, fallback);
	}

	/** Whether the server said the current user may not (any more) do this in the team (e.g. they were removed or demoted meanwhile). */
	static isAccessLost(error: unknown): boolean {
		return error instanceof ApiError && (error.type === TeamApi.FORBIDDEN || error.status === 403);
	}

	/** The message for any other failure. */
	static general(error: unknown, fallback: Translatable): Translatable {
		return ProblemText.describe(error, fallback);
	}

	/** Whether the server said the session has ended. */
	static isSessionEnded(error: unknown): boolean {
		return ProblemText.isSessionEnded(error);
	}

	private static fieldParts(error: ApiError): Translatable[] {
		const parts: Translatable[] = [];
		const name = ProblemText.fieldError(error, "name");
		if (name) {
			parts.push((m) => m.teams.invalidName(name(m)));
		}
		const logo = ProblemText.fieldError(error, "logo");
		if (logo) {
			parts.push((m) => m.teams.invalidLogo(logo(m)));
		}
		return parts;
	}
}
