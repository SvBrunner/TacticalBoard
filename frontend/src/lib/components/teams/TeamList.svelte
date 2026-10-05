<!--
@component
A list of teams (arc42 ch. 8.17): each a link to its page (`/teams/<CODE>`)
with logo, name and code, and — for the user's own teams — their role.
-->
<script lang="ts">
	import { t } from "$lib/i18n";
	import type { TeamRole, TeamSummary } from "$lib/teams/TeamApi";
	import { TeamRoute } from "$lib/teams/TeamRoute";
	import TeamLogo from "./TeamLogo.svelte";

	interface Props {
		teams: readonly (TeamSummary & { readonly role?: TeamRole })[];
		/** The list's accessible name, if it needs one (e.g. "Your teams"). */
		label?: string;
	}

	let { teams, label }: Props = $props();
</script>

<ul class="team-list" aria-label={label}>
	{#each teams as team (team.id)}
		<li>
			<a class="team" href={TeamRoute.forTeam(team.code)}>
				<TeamLogo logoUrl={team.logoUrl} name={team.name} />
				<span class="text">
					<span class="name">{team.name}</span>
					<span class="meta">
						<span class="code">{$t.teams.codeLabel(team.code)}</span>
						{#if team.role}
							<span class="role">{$t.teams.roles[team.role]}</span>
						{/if}
					</span>
				</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	.team-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 8px;
	}

	.team {
		min-height: var(--touch-target);
		padding: 8px 12px;
		display: flex;
		align-items: center;
		gap: 12px;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		box-shadow: inset 0 0 0 1px var(--border);
		color: var(--text);
		text-decoration: none;
	}

	.team:hover .name {
		color: var(--accent);
	}

	.team:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		font-size: 16px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.code {
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
	}

	.role {
		padding: 0 6px;
		border-radius: var(--radius-sm);
		box-shadow: inset 0 0 0 1px var(--border);
	}
</style>
