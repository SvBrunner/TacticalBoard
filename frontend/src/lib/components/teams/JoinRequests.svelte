<!--
@component
The pending join requests of a team, for its Admins (arc42 ch. 8.17):
oldest first, each with who asked and when, and Accept (the user becomes a
Reader) and Reject (they may ask again). The outcome is announced; a
failure (e.g. another Admin decided it meanwhile) is shown as an alert.
-->
<script lang="ts">
	import { language, t } from "$lib/i18n";
	import type { Translatable } from "$lib/i18n/Messages";
	import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";
	import type { JoinRequest, TeamMember } from "$lib/teams/TeamApi";
	import type { TeamJoinRequestListState } from "$lib/teams/TeamJoinRequestList";
	import type { MembershipOutcome } from "$lib/teams/TeamMessages";

	interface Props {
		list: TeamJoinRequestListState;
		onAccept: (request: JoinRequest) => Promise<MembershipOutcome<TeamMember>>;
		onReject: (request: JoinRequest) => Promise<MembershipOutcome<JoinRequest>>;
		onRetry: () => void;
	}

	let { list, onAccept, onReject, onRetry }: Props = $props();

	let busy = $state(false);
	let status: Translatable | null = $state(null);
	let error: Translatable | null = $state(null);

	async function decide(request: JoinRequest, accept: boolean) {
		busy = true;
		status = null;
		error = null;
		const outcome = accept ? await onAccept(request) : await onReject(request);
		busy = false;
		if (outcome.ok) {
			status = (m) => (accept ? m.joinRequests.accepted : m.joinRequests.rejected)(request.user.displayName ?? m.situation.deletedUser);
		} else {
			error = outcome.message;
		}
	}
</script>

{#if list.status === "loading"}
	<p class="hint" role="status">{$t.joinRequests.loading}</p>
{:else if list.status === "failed"}
	<div class="failure" role="alert">
		<p class="hint">{list.message($t)}</p>
		<button type="button" class="tool" onclick={onRetry}>{$t.common.tryAgain}</button>
	</div>
{:else}
	{#if list.requests.length === 0}
		<p class="hint">{$t.joinRequests.none}</p>
	{:else}
		<ul class="requests" aria-label={$t.joinRequests.heading}>
			{#each list.requests as request (request.id)}
				{@const name = request.user.displayName ?? $t.situation.deletedUser}
				<li class="request">
					<span class="text">
						<span class="name">{name}</span>
						<time class="meta" datetime={request.requestedAt}>{$t.joinRequests.requestedAt(SavedSituationFormat.dateTime(request.requestedAt, $language))}</time>
					</span>
					<span class="actions">
						<button type="button" class="tool accept" disabled={busy} aria-label={$t.joinRequests.acceptFor(name)} onclick={() => void decide(request, true)}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M5 12l5 5L20 7" />
							</svg>
							{$t.joinRequests.accept}
						</button>
						<button type="button" class="tool danger" disabled={busy} aria-label={$t.joinRequests.rejectFor(name)} onclick={() => void decide(request, false)}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M6 6l12 12M18 6L6 18" />
							</svg>
							{$t.joinRequests.reject}
						</button>
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	<p class="status" role="status">{status?.($t) ?? ""}</p>
	{#if error}
		<p class="error" role="alert">{error($t)}</p>
	{/if}
{/if}

<style>
	.requests {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.request {
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

	.text {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.name {
		font-size: 15px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.meta {
		font-size: 13px;
		color: var(--text-muted);
	}

	.actions {
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
		background: var(--bg-surface);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.tool.accept {
		color: var(--accent);
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
</style>
