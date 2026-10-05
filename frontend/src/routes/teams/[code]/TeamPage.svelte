<!--
@component
The content of a team's page (`/teams/<CODE>`, deep-linkable; arc42 ch. 8.8,
8.17): the shared navbar with the team's name as title, a breadcrumb (Start
page › Teams › team), the team's logo, name, code and link, and the current
user's role. Its Admins rename the team and upload, replace or remove its
logo. Non-members see the public data and a note that joining comes later
(join requests: roadmap Phase 2 step 7). Without login or server it explains
why it can't show the team; a team that doesn't exist (any more) says so.
-->
<script lang="ts">
	import { authSession } from "$lib/auth/AuthSession";
	import ConfirmDialog from "$lib/components/dialogs/ConfirmDialog.svelte";
	import AppNavbar from "$lib/components/navigation/AppNavbar.svelte";
	import TeamLogo from "$lib/components/teams/TeamLogo.svelte";
	import TeamLogoEditor from "$lib/components/teams/TeamLogoEditor.svelte";
	import TeamNameDialog from "$lib/components/teams/TeamNameDialog.svelte";
	import { notifications } from "$lib/debug/Notifications";
	import { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { t } from "$lib/i18n";
	import { CurrentTeam } from "$lib/teams/CurrentTeam";
	import { TeamRoute } from "$lib/teams/TeamRoute";
	import { teamApi } from "$lib/teams/teamStorage";

	interface Props {
		/** The team's code from the URL; fixed for the component's life (the route re-creates it for another team). */
		code: string;
	}

	let props: Props = $props();

	// svelte-ignore state_referenced_locally
	const code = props.code;
	const uid = $props.id();
	const sessionState = authSession.state;
	const team = new CurrentTeam({ api: teamApi, code, onSessionEnded: () => void authSession.refresh(), log: notifications });
	const teamState = team.state;
	const prompt = new ConfirmationPrompt();
	const question = prompt.pending;

	let renaming = $state(false);
	const name = $derived($teamState.status === "loaded" ? $teamState.team.name : null);
	const isAdmin = $derived($teamState.status === "loaded" && $teamState.team.role === "admin");

	$effect(() => {
		if ($sessionState.status === "authenticated") {
			void team.load();
		}
	});

	async function removeLogo() {
		const confirmed = await prompt.request({
			title: (m) => m.teamPage.removeLogoQuestion,
			message: (m) => m.teamPage.removeLogoMessage(name ?? code),
			confirmLabel: (m) => m.teamPage.remove,
			cancelLabel: (m) => m.common.cancel,
		});
		return confirmed ? team.removeLogo() : null;
	}
</script>

<svelte:head>
	<title>{$t.app.pageTitle(name ?? $t.teamPage.title)}</title>
</svelte:head>

<AppNavbar title={name ?? $t.teamPage.title} loginReturnTo={TeamRoute.forTeam(code)} />

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
				<dl class="facts">
					<div>
						<dt>{$t.teamPage.code}</dt>
						<dd class="code">{current.code}</dd>
					</div>
					<div>
						<dt>{$t.teamPage.link}</dt>
						<dd><a class="link" href={TeamRoute.forTeam(current.code)}>{TeamRoute.linkTo(current.code, window.location.origin)}</a></dd>
					</div>
					{#if current.role}
						<div>
							<dt>{$t.teamPage.yourRole}</dt>
							<dd>{$t.teams.roles[current.role]}</dd>
						</div>
					{/if}
				</dl>
				{#if !current.role}
					<p class="hint">{$t.teamPage.notMember} {$t.teamPage.joiningLater}</p>
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

			{#if isAdmin}
				<section class="panel" aria-labelledby="{uid}-logo">
					<h2 id="{uid}-logo" class="panel-title">{$t.teamPage.logo}</h2>
					{#if !current.logoUrl}
						<p class="hint">{$t.teamPage.noLogo}</p>
					{/if}
					<TeamLogoEditor team={current} upload={(file) => team.setLogo(file)} remove={removeLogo} />
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
