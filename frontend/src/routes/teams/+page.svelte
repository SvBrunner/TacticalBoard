<!--
@component
The team overview (`/teams`, arc42 ch. 8.8, 8.17): for logged-in users all
teams with name, logo and code, searchable by name or code (the search runs
while typing, after a short pause, or at once with Search), a page at a time
with "Show more". Each team links to its page. Without login or server it
says why there is nothing to show.
-->
<script lang="ts">
	import { onDestroy, untrack } from "svelte";
	import { authSession } from "$lib/auth/AuthSession";
	import AppNavbar from "$lib/components/navigation/AppNavbar.svelte";
	import TeamList from "$lib/components/teams/TeamList.svelte";
	import { notifications } from "$lib/debug/Notifications";
	import { t } from "$lib/i18n";
	import { TeamOverview } from "$lib/teams/TeamOverview";
	import { TeamRoute } from "$lib/teams/TeamRoute";
	import { teamApi } from "$lib/teams/teamStorage";

	const uid = $props.id();
	const sessionState = authSession.state;
	const overview = new TeamOverview({ api: teamApi, onSessionEnded: () => void authSession.refresh(), log: notifications });
	const overviewState = overview.state;
	let text = $state("");

	// The teams are only for logged-in users: (re)load them whenever the login state says so.
	$effect(() => {
		if ($sessionState.status === "authenticated") {
			void overview.search(untrack(() => text));
		}
	});

	onDestroy(() => overview.dispose());

	function submit(event: SubmitEvent) {
		event.preventDefault();
		void overview.search(text);
	}
</script>

<svelte:head>
	<title>{$t.app.pageTitle($t.teamOverview.title)}</title>
</svelte:head>

<AppNavbar title={$t.teamOverview.title} loginReturnTo={TeamRoute.OVERVIEW} />

<main class="teams-page">
	<nav aria-label={$t.teamOverview.breadcrumb} class="breadcrumb">
		<ol>
			<li><a href="/">{$t.teamOverview.startPage}</a></li>
			<li><span aria-current="page">{$t.teamOverview.title}</span></li>
		</ol>
	</nav>

	{#if $sessionState.status === "anonymous"}
		<p class="hint">{$t.teamOverview.logInHint}</p>
	{:else if $sessionState.status === "unavailable"}
		<p class="hint">{$t.teamOverview.unavailableHint}</p>
	{:else if $sessionState.status === "authenticated"}
		<form class="panel search" role="search" onsubmit={submit}>
			<label for="{uid}-search" class="search-label">{$t.teamOverview.searchLabel}</label>
			<div class="search-row">
				<input
					id="{uid}-search"
					class="search-input"
					type="search"
					name="search"
					autocomplete="off"
					bind:value={text}
					oninput={() => overview.type(text)}
				/>
				<button type="submit" class="tool">{$t.teamOverview.searchButton}</button>
			</div>
		</form>

		<section class="panel" aria-labelledby="{uid}-results" aria-busy={$overviewState.status === "loading"}>
			<h2 id="{uid}-results" class="panel-title">{$t.teamOverview.title}</h2>
			{#if $overviewState.status === "loading" || $overviewState.status === "idle"}
				<p class="hint" role="status">{$t.teamOverview.loading}</p>
			{:else if $overviewState.status === "failed"}
				<div class="failure" role="alert">
					<p class="hint">{$overviewState.message($t)}</p>
					<button type="button" class="tool" onclick={() => void overview.search(text)}>{$t.common.tryAgain}</button>
				</div>
			{:else if $overviewState.teams.length === 0}
				<p class="hint" role="status">
					{$overviewState.query ? $t.teamOverview.noMatches($overviewState.query) : $t.teamOverview.none}
				</p>
			{:else}
				<p class="count" role="status">{$t.teamOverview.count($overviewState.total)}</p>
				<TeamList teams={$overviewState.teams} />
				{#if $overviewState.teams.length < $overviewState.total}
					<button type="button" class="tool more" disabled={$overviewState.loadingMore} onclick={() => void overview.showMore()}>
						{$t.teamOverview.showMore}
					</button>
				{/if}
			{/if}
		</section>
	{/if}
</main>

<style>
	.teams-page {
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

	.search {
		gap: 8px;
	}

	.search-label {
		font-size: 14px;
		font-weight: 600;
	}

	.search-row {
		display: flex;
		gap: 8px;
	}

	.search-input {
		flex: 1;
		min-width: 0;
		min-height: var(--touch-target);
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		font: inherit;
		font-size: 16px;
		box-sizing: border-box;
	}

	.search-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.hint,
	.count {
		margin: 0;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.failure {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
	}

	.tool {
		min-height: var(--touch-target);
		padding: 0 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
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

	.tool:disabled {
		opacity: 0.6;
		cursor: default;
	}

	.more {
		align-self: center;
	}

	@media (max-width: 599px) {
		.teams-page {
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
