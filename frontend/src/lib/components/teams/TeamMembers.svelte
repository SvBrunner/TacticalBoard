<!--
@component
A team's member list (arc42 ch. 8.17): every member sees it — display name
(the current user marked "(you)", a deleted user as "Deleted user") and
role. For the team's Admins each member has a role picker (Admin, Editor,
Reader; their own included) and a Remove button (`onRemove` asks first).
The outcome of a change is announced; a refusal (e.g. the team's last
Admin) is shown as an alert.
-->
<script lang="ts">
	import { t } from "$lib/i18n";
	import type { Messages, Translatable } from "$lib/i18n/Messages";
	import { TEAM_ROLES, type TeamMember, type TeamRole } from "$lib/teams/TeamApi";
	import type { TeamMemberListState } from "$lib/teams/TeamMemberList";
	import type { MembershipOutcome } from "$lib/teams/TeamMessages";

	interface Props {
		list: TeamMemberListState;
		/** The logged-in user, marked "(you)". */
		currentUserId: string;
		/** Whether the user may change roles and remove members (the team's Admins). */
		canManage: boolean;
		onChangeRole: (member: TeamMember, role: TeamRole) => Promise<MembershipOutcome<TeamMember>>;
		/** Removes the member after asking; `null` when the user cancelled. */
		onRemove: (member: TeamMember) => Promise<MembershipOutcome<TeamMember> | null>;
		onRetry: () => void;
	}

	let { list, currentUserId, canManage, onChangeRole, onRemove, onRetry }: Props = $props();

	const uid = $props.id();
	let busy = $state(false);
	let status: Translatable | null = $state(null);
	let error: Translatable | null = $state(null);

	function nameOf(member: TeamMember, messages: Messages): string {
		const name = member.displayName ?? messages.situation.deletedUser;
		return member.userId === currentUserId ? messages.teamMembers.you(name) : name;
	}

	async function run(action: () => Promise<MembershipOutcome<TeamMember> | null>, done: (member: TeamMember) => Translatable) {
		busy = true;
		status = null;
		error = null;
		const outcome = await action();
		busy = false;
		if (outcome?.ok) {
			const member = outcome.value;
			status = done(member);
		} else if (outcome) {
			error = outcome.message;
		}
	}

	function changeRole(member: TeamMember, event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const role = select.value as TeamRole;
		// Show the current role until the server confirms the change.
		select.value = member.role;
		void run(
			() => onChangeRole(member, role),
			(changed) => (m) => m.teamMembers.roleChanged(changed.displayName ?? m.situation.deletedUser, m.teams.roles[changed.role]),
		);
	}

	function remove(member: TeamMember) {
		void run(
			() => onRemove(member),
			(removed) => (m) => m.teamMembers.removed(removed.displayName ?? m.situation.deletedUser),
		);
	}
</script>

{#if list.status === "loading"}
	<p class="hint" role="status">{$t.teamMembers.loading}</p>
{:else if list.status === "failed"}
	<div class="failure" role="alert">
		<p class="hint">{list.message($t)}</p>
		<button type="button" class="tool" onclick={onRetry}>{$t.common.tryAgain}</button>
	</div>
{:else}
	<p class="hint">{$t.teamMembers.count(list.members.length)}</p>
	<ul class="members" aria-label={$t.teamMembers.heading}>
		{#each list.members as member (member.userId)}
			<li class="member">
				<span class="name">{nameOf(member, $t)}</span>
				{#if canManage}
					<span class="actions">
						<label class="visually-hidden" for="{uid}-role-{member.userId}">{$t.teamMembers.roleOf(nameOf(member, $t))}</label>
						<select id="{uid}-role-{member.userId}" class="role-picker" value={member.role} disabled={busy} onchange={(event) => changeRole(member, event)}>
							{#each TEAM_ROLES as role (role)}
								<option value={role}>{$t.teams.roles[role]}</option>
							{/each}
						</select>
						<button type="button" class="tool danger" disabled={busy} aria-label={$t.teamMembers.removeMember(nameOf(member, $t))} onclick={() => remove(member)}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M17 11h6" />
							</svg>
							<span class="label">{$t.teamMembers.remove}</span>
						</button>
					</span>
				{:else}
					<span class="role">{$t.teams.roles[member.role]}</span>
				{/if}
			</li>
		{/each}
	</ul>
	<p class="status" role="status">{status?.($t) ?? ""}</p>
	{#if error}
		<p class="error" role="alert">{error($t)}</p>
	{/if}
{/if}

<style>
	.members {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.member {
		min-height: var(--touch-target);
		padding: 6px 12px;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.name {
		min-width: 0;
		font-size: 15px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.role {
		padding: 0 6px;
		border-radius: var(--radius-sm);
		box-shadow: inset 0 0 0 1px var(--border);
		font-size: 13px;
		color: var(--text-muted);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}

	.role-picker {
		min-height: var(--touch-target);
		padding: 0 8px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		font-size: 14px;
	}

	.tool {
		min-height: var(--touch-target);
		min-width: var(--touch-target);
		padding: 0 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.tool.danger {
		color: var(--danger);
	}

	.tool:disabled,
	.role-picker:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.tool:focus-visible,
	.role-picker:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.hint,
	.status {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.error {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--danger);
	}

	.failure {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 599px) {
		.tool .label {
			display: none;
		}

		.tool {
			padding: 0;
		}
	}
</style>
