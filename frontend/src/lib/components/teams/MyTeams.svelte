<!--
@component
The current user's teams on the start page (arc42 ch. 8.17): each a link to
its page with logo, name, code and the user's role, in the server's order
(by name). Shows loading, a failure with "Try again", or that the user is in
no team yet.
-->
<script lang="ts">
	import { t } from "$lib/i18n";
	import type { MyTeamListState } from "$lib/teams/MyTeamList";
	import TeamList from "./TeamList.svelte";

	interface Props {
		list: MyTeamListState;
		onRetry: () => void;
	}

	let { list, onRetry }: Props = $props();
</script>

{#if list.status === "loading" || list.status === "idle"}
	<p class="hint" role="status">{$t.teams.loading}</p>
{:else if list.status === "failed"}
	<div class="failure" role="alert">
		<p class="hint">{list.message($t)}</p>
		<button type="button" class="retry" onclick={onRetry}>{$t.common.tryAgain}</button>
	</div>
{:else if list.teams.length === 0}
	<p class="hint">{$t.teams.none}</p>
{:else}
	<TeamList teams={list.teams} label={$t.teams.mine} />
{/if}

<style>
	.hint {
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

	.retry {
		min-height: var(--touch-target);
		padding: 0 12px;
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

	.retry:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
