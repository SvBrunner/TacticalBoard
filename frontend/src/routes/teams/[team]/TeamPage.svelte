<!--
@component
The content of a team's page (`/teams/<CODE>` or `/teams/<id>`,
deep-linkable; arc42 ch. 8.8, 8.17): the shared navbar with the team's name
as title, a breadcrumb (Start page › Teams › team), the team's logo and
name. Members also see its code, the link to share, their role, the team's
situations and folders (`TeamContent`: Admins and Editors also start, move
and delete situations and create folders; Readers only open them), the member
list, and "Leave team" (after a confirmation; the last Admin is refused with
the reason). Non-members see only name and logo, and "Ask to join" — or that
their request is pending. Admins rename the team, upload, replace or remove
its logo, change roles and remove members (after a confirmation), accept or
reject join requests (with their count), and delete the team (after a
confirmation; then the start page opens). Without login or server it
explains why it can't show the team; a team that doesn't exist (any more)
says so.
-->
<script lang="ts">
	import { goto } from "$app/navigation";
	import { authSession } from "$lib/auth/AuthSession";
	import ConfirmDialog from "$lib/components/dialogs/ConfirmDialog.svelte";
	import AppNavbar from "$lib/components/navigation/AppNavbar.svelte";
	import JoinRequests from "$lib/components/teams/JoinRequests.svelte";
	import TeamLogo from "$lib/components/teams/TeamLogo.svelte";
	import TeamLogoEditor from "$lib/components/teams/TeamLogoEditor.svelte";
	import TeamMembers from "$lib/components/teams/TeamMembers.svelte";
	import TeamNameDialog from "$lib/components/teams/TeamNameDialog.svelte";
	import { notifications } from "$lib/debug/Notifications";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { t } from "$lib/i18n";
	import type { Translatable } from "$lib/i18n/Messages";
	import { CurrentTeam } from "$lib/teams/CurrentTeam";
	import { canWriteContent, type JoinRequest, type TeamMember, type TeamRole } from "$lib/teams/TeamApi";
	import { TeamJoinRequestList } from "$lib/teams/TeamJoinRequestList";
	import { TeamMemberList } from "$lib/teams/TeamMemberList";
	import { TeamRoute } from "$lib/teams/TeamRoute";
	import { teamApi } from "$lib/teams/teamStorage";
	import TeamContent from "./TeamContent.svelte";

	interface Props {
		/** The team's code (or id) from the URL; fixed for the component's life (the route re-creates it for another team). */
		teamKey: string;
	}

	let props: Props = $props();

	// svelte-ignore state_referenced_locally
	const key = props.teamKey;
	const uid = $props.id();
	const sessionState = authSession.state;
	const refreshSession = () => void authSession.refresh();
	const team = new CurrentTeam({ api: teamApi, key, onSessionEnded: refreshSession, log: notifications });
	const teamState = team.state;
	const reloadTeam = () => void team.load(true);
	const prompt = new ConfirmationPrompt();
	const question = prompt.pending;
	const members = new TeamMemberList({
		api: teamApi,
		key,
		onAccessLost: reloadTeam,
		onSessionEnded: refreshSession,
		currentUserId: () => {
			const session = authSession.current();
			return session.status === "authenticated" ? session.user.id : "";
		},
		// Giving oneself a lower role asks first (confirmed product decision).
		confirm: (request) => prompt.request(request),
		log: notifications,
	});
	const memberState = members.state;
	const joinRequests = new TeamJoinRequestList({
		api: teamApi,
		key,
		onDecided: () => {
			void members.load(true);
			reloadTeam();
		},
		onAccessLost: reloadTeam,
		onSessionEnded: refreshSession,
		log: notifications,
	});
	const joinRequestState = joinRequests.state;

	let renaming = $state(false);
	let busy = $state(false);
	let joinStatus: Translatable | null = $state(null);
	let joinError: Translatable | null = $state(null);
	let leaveError: Translatable | null = $state(null);
	let leftStatus: Translatable | null = $state(null);
	let deleteError: Translatable | null = $state(null);
	const name = $derived($teamState.status === "loaded" ? $teamState.team.name : null);
	const role = $derived($teamState.status === "loaded" ? $teamState.team.role : null);
	const isAdmin = $derived(role === "admin");
	const currentUserId = $derived($sessionState.status === "authenticated" ? $sessionState.user.id : "");

	$effect(() => {
		if ($sessionState.status === "authenticated") {
			void team.load();
		}
	});

	// What a member sees follows their role: the member list for every member, the join requests for Admins.
	$effect(() => {
		if (role) {
			void members.load(true);
		}
	});

	$effect(() => {
		if (role === "admin") {
			void joinRequests.load(true);
		}
	});

	async function askToJoin() {
		busy = true;
		joinError = null;
		joinStatus = null;
		const outcome = await team.requestToJoin();
		busy = false;
		if (outcome.ok) {
			joinStatus = (m) => m.teamPage.joinRequestSent;
		} else {
			joinError = outcome.message;
		}
	}

	async function changeRole(member: TeamMember, newRole: TeamRole) {
		const outcome = await members.changeRole(member, newRole, name ?? key);
		if (outcome?.ok && member.userId === currentUserId) {
			// The own role changed: the page shows what the user may do now.
			reloadTeam();
		}
		return outcome;
	}

	async function removeMember(member: TeamMember) {
		const memberName = member.displayName ?? $t.situation.deletedUser;
		const confirmed = await prompt.request({
			title: (m) => m.teamMembers.removeQuestion,
			message: (m) => m.teamMembers.removeMessage(member.displayName ?? m.situation.deletedUser, name ?? key),
			confirmLabel: (m) => m.teamMembers.remove,
			cancelLabel: (m) => m.common.cancel,
		});
		if (!confirmed) {
			return null;
		}
		const outcome = await members.remove(member, name ?? memberName);
		if (outcome.ok && member.userId === currentUserId) {
			reloadTeam();
		}
		return outcome;
	}

	async function leave() {
		const teamName = name ?? key;
		const confirmed = await prompt.request({
			title: (m) => m.teamPage.leaveQuestion,
			message: (m) => m.teamPage.leaveMessage(teamName),
			confirmLabel: (m) => m.teamPage.leaveConfirm,
			cancelLabel: (m) => m.common.cancel,
		});
		if (!confirmed) {
			return;
		}
		busy = true;
		leaveError = null;
		const outcome = await team.leave();
		busy = false;
		if (outcome.ok) {
			leftStatus = (m) => m.teamPage.left(teamName);
		} else {
			leaveError = outcome.message;
		}
	}

	async function deleteTeam() {
		const teamName = name ?? key;
		const confirmed = await prompt.request({
			title: (m) => m.teamPage.deleteQuestion,
			message: (m) => m.teamPage.deleteMessage(teamName),
			confirmLabel: (m) => m.teamPage.deleteConfirm,
			cancelLabel: (m) => m.common.cancel,
		});
		if (!confirmed) {
			return;
		}
		busy = true;
		deleteError = null;
		const outcome = await team.delete();
		busy = false;
		if (outcome.ok) {
			void goto("/");
		} else {
			deleteError = outcome.message;
		}
	}

	function accept(request: JoinRequest) {
		return joinRequests.accept(request, name ?? key);
	}

	function reject(request: JoinRequest) {
		return joinRequests.reject(request, name ?? key);
	}
</script>

<svelte:head>
	<title>{$t.app.pageTitle(name ?? $t.teamPage.title)}</title>
</svelte:head>

<AppNavbar title={name ?? $t.teamPage.title} loginReturnTo={TeamRoute.forTeam(key)} />

<main class="team-page">
	<nav aria-label={$t.teamOverview.breadcrumb} class="breadcrumb">
		<ol>
			<li><a href="/">{$t.teamOverview.startPage}</a></li>
			<li><a href={TeamRoute.OVERVIEW}>{$t.teamOverview.title}</a></li>
			<li><span aria-current="page">{name ?? $t.teamPage.title}</span></li>
		</ol>
	</nav>

	{#if $sessionState.status === "anonymous"}
		<p class="hint">{$t.teamPage.logInHint}</p>
	{:else if $sessionState.status === "unavailable"}
		<p class="hint">{$t.teamPage.unavailableHint}</p>
	{:else if $sessionState.status === "authenticated"}
		{#if $teamState.status === "loading"}
			<p class="hint" role="status">{$t.teamPage.loading}</p>
		{:else if $teamState.status === "missing"}
			<p class="hint">{$t.teamPage.missing} <a href={TeamRoute.OVERVIEW}>{$t.teamPage.backToTeams}</a></p>
		{:else if $teamState.status === "failed"}
			<div class="failure" role="alert">
				<p class="hint">{$teamState.message($t)}</p>
				<button type="button" class="tool" onclick={() => void team.load()}>{$t.common.tryAgain}</button>
			</div>
		{:else}
			{@const current = $teamState.team}
			<section class="panel" aria-labelledby="{uid}-heading">
				<h2 id="{uid}-heading" class="panel-title">{$t.teamPage.heading}</h2>
				<div class="identity">
					<TeamLogo logoUrl={current.logoUrl} name={current.name} size={96} alt={current.logoUrl ? $t.teamPage.logoAlt(current.name) : ""} />
					<p class="team-name">{current.name}</p>
				</div>
				{#if current.code || current.role}
					<dl class="facts">
						{#if current.code}
							<div>
								<dt>{$t.teamPage.code}</dt>
								<dd class="code">{current.code}</dd>
							</div>
							<div>
								<dt>{$t.teamPage.link}</dt>
								<dd><a class="link" href={TeamRoute.forTeam(current.code)}>{TeamRoute.linkTo(current.code, window.location.origin)}</a></dd>
							</div>
						{/if}
						{#if current.role}
							<div>
								<dt>{$t.teamPage.yourRole}</dt>
								<dd>{$t.teams.roles[current.role]}</dd>
							</div>
						{/if}
					</dl>
				{/if}
				{#if !current.role}
					{#if leftStatus}
						<p class="hint" role="status">{leftStatus($t)}</p>
					{/if}
					<p class="hint">{$t.teamPage.notMember}</p>
					{#if current.joinRequestPending}
						<p class="pending" role="status">{$t.teamPage.joinRequestPending}</p>
					{:else}
						<p class="hint">{$t.teamPage.joinHint}</p>
						<div>
							<button type="button" class="tool primary" disabled={busy} onclick={() => void askToJoin()}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
									<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
									<circle cx="9" cy="7" r="4" />
									<path d="M20 8v6M17 11h6" />
								</svg>
								{$t.teamPage.askToJoin}
							</button>
						</div>
					{/if}
					{#if joinStatus && current.joinRequestPending}
						<p class="visually-hidden" role="status">{joinStatus($t)}</p>
					{/if}
					{#if joinError}
						<p class="error" role="alert">{joinError($t)}</p>
					{/if}
				{/if}
				{#if isAdmin}
					<ul class="tools">
						<li>
							<button type="button" class="tool" onclick={() => (renaming = true)}>
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
									<path d="M4 20h4L19 9l-4-4L4 16z" />
									<path d="M13.5 6.5l4 4" />
								</svg>
								{$t.teamPage.rename}
							</button>
						</li>
					</ul>
				{/if}
			</section>

			{#if current.role}
				<!-- Re-created when the role changes, so the offered actions follow it. -->
				{#key current.role}
					<TeamContent teamId={current.id} canWrite={canWriteContent(current.role)} />
				{/key}
			{/if}

			{#if isAdmin}
				<section class="panel" aria-labelledby="{uid}-logo">
					<h2 id="{uid}-logo" class="panel-title">{$t.teamPage.logo}</h2>
					{#if !current.logoUrl}
						<p class="hint">{$t.teamPage.noLogo}</p>
					{/if}
					<TeamLogoEditor team={current} upload={(file) => team.setLogo(file)} remove={() => team.removeLogo()} />
				</section>

				<section class="panel" aria-labelledby="{uid}-requests">
					<h2 id="{uid}-requests" class="panel-title">
						{$t.joinRequests.heading}
						{#if current.pendingJoinRequests}
							<span class="badge">{$t.joinRequests.count(current.pendingJoinRequests)}</span>
						{/if}
					</h2>
					<JoinRequests list={$joinRequestState} onAccept={accept} onReject={reject} onRetry={() => void joinRequests.load()} />
				</section>
			{/if}

			{#if current.role}
				<section class="panel" aria-labelledby="{uid}-members">
					<h2 id="{uid}-members" class="panel-title">{$t.teamMembers.heading}</h2>
					<TeamMembers
						list={$memberState}
						{currentUserId}
						canManage={isAdmin}
						onChangeRole={changeRole}
						onRemove={removeMember}
						onRetry={() => void members.load()}
					/>
					<div>
						<button type="button" class="tool" disabled={busy} onclick={() => void leave()}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
								<path d="M16 17l5-5-5-5M21 12H9" />
							</svg>
							{$t.teamPage.leave}
						</button>
					</div>
					{#if leaveError}
						<p class="error" role="alert">{leaveError($t)}</p>
					{/if}
				</section>
			{/if}

			{#if isAdmin}
				<section class="panel" aria-labelledby="{uid}-delete">
					<h2 id="{uid}-delete" class="panel-title">{$t.teamPage.deleteHeading}</h2>
					<p class="hint">{$t.teamPage.deleteHint}</p>
					<div>
						<button type="button" class="tool danger" disabled={busy} onclick={() => void deleteTeam()}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
							</svg>
							{$t.teamPage.delete}
						</button>
					</div>
					{#if deleteError}
						<p class="error" role="alert">{deleteError($t)}</p>
					{/if}
				</section>
			{/if}
		{/if}
	{/if}
</main>

<TeamNameDialog open={renaming} initialName={name ?? ""} onSubmit={(newName) => team.rename(newName)} onClose={() => (renaming = false)} />

<ConfirmDialog
	open={$question !== null}
	title={$question?.title($t) ?? ""}
	message={$question?.message($t) ?? ""}
	confirmLabel={$question?.confirmLabel($t) ?? $t.common.ok}
	cancelLabel={$question?.cancelLabel?.($t)}
	onConfirm={() => prompt.answer(true)}
	onCancel={() => prompt.answer(false)}
/>

<style>
	.team-page {
		width: min(720px, 100%);
		margin: 0 auto;
		padding: 24px;
		padding-left: calc(24px + env(safe-area-inset-left, 0px));
		padding-right: calc(24px + env(safe-area-inset-right, 0px));
		padding-bottom: calc(48px + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 24px;
		box-sizing: border-box;
	}

	.breadcrumb ol {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		font-size: 14px;
	}

	.breadcrumb li + li::before {
		content: "›";
		margin-right: 4px;
		color: var(--text-muted);
	}

	.breadcrumb a {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch-target);
		color: var(--accent);
	}

	.breadcrumb [aria-current="page"] {
		color: var(--text-muted);
		overflow-wrap: anywhere;
	}

	.panel {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.panel-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.identity {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.team-name {
		margin: 0;
		font-size: 20px;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.facts {
		margin: 0;
		display: grid;
		gap: 8px;
	}

	.facts div {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}

	.facts dt {
		min-width: 6em;
		font-size: 14px;
		color: var(--text-muted);
	}

	.facts dd {
		margin: 0;
		font-size: 14px;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.code {
		font-weight: 700;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}

	.link {
		color: var(--accent);
	}

	.hint {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.hint a {
		color: var(--accent);
	}

	.pending {
		margin: 0;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		box-shadow: inset 0 0 0 1px var(--border);
		font-size: 14px;
		line-height: 1.5;
	}

	.error {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--danger);
	}

	.badge {
		margin-left: 8px;
		padding: 0 6px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-contrast);
		font-size: 13px;
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

	.failure {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
	}

	.tools {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.tool {
		min-height: var(--touch-target);
		padding: 0 12px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.tool.primary {
		background: var(--accent);
		color: var(--accent-contrast);
		box-shadow: none;
	}

	.tool.danger {
		color: var(--danger);
	}

	.tool:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.tool:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	@media (max-width: 599px) {
		.team-page {
			padding-top: 8px;
			padding-left: calc(16px + env(safe-area-inset-left, 0px));
			padding-right: calc(16px + env(safe-area-inset-right, 0px));
			gap: 16px;
		}

		.panel {
			padding: 16px;
			border-radius: var(--radius-md);
		}
	}
</style>
