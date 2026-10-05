<!--
@component
The saved situations of one place of an area (arc42 ch. 8.15): the top
level of the personal area on the start page, of a team on its page, or a
folder on its page. Each with title, field
type, last changed by/at and created by; a situation opens with its title
button, Move offers the other folders of the area (`onMove` opens the
picker), and Delete deletes it (the owner asks for confirmation). An empty
place shows `emptyMessage` and, if given, `emptyActions` (e.g. a folder's page
offers New situation and Import there). With `canChange` false (a team
Reader, ch. 8.1) only opening is offered, no Move or Delete. Without login a hint to log in;
without a server a hint that local mode works as usual.
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import type { SessionState } from "$lib/auth/AuthSession";
	import { language, t } from "$lib/i18n";
	import type { SavedListState } from "$lib/storage/SavedSituationList";
	import { SavedSituationFormat } from "$lib/storage/SavedSituationFormat";
	import type { SituationSummary } from "$lib/storage/SituationApi";

	interface Props {
		session: SessionState;
		list: SavedListState;
		onOpen: (situation: SituationSummary) => void;
		onDelete: (situation: SituationSummary) => void;
		/** Move was chosen (the owner shows the folder picker). */
		onMove: (situation: SituationSummary) => void;
		onRetry: () => void;
		/** Shown when the place has no situations (default: "No saved situations yet…"). */
		emptyMessage?: string;
		/** Actions offered when the place has no situations, below `emptyMessage`. */
		emptyActions?: Snippet;
		/** Disables the buttons (e.g. while a situation is being opened). */
		busy?: boolean;
		/** Whether Move and Delete are offered (false for a team Reader). */
		canChange?: boolean;
	}

	let {
		session,
		list,
		onOpen,
		onDelete,
		onMove,
		onRetry,
		emptyMessage,
		emptyActions,
		busy = false,
		canChange = true,
	}: Props = $props();

	const uid = $props.id();
</script>

{#if session.status === "anonymous"}
	<p class="hint">{$t.saved.logInHint}</p>
{:else if session.status === "unavailable"}
	<p class="hint">{$t.saved.unavailableHint}</p>
{:else if session.status === "authenticated"}
	{#if list.status === "loading" || list.status === "idle"}
		<p class="hint" role="status">{$t.saved.loading}</p>
	{:else if list.status === "failed"}
		<div class="failure" role="alert">
			<p class="hint">{list.message($t)}</p>
			<button type="button" class="retry" onclick={onRetry}>{$t.common.tryAgain}</button>
		</div>
	{:else if list.situations.length === 0}
		<p class="hint">{emptyMessage ?? $t.saved.empty}</p>
		{@render emptyActions?.()}
	{:else}
		<ul class="saved-list">
			{#each list.situations as situation, index (situation.id)}
				<li class="saved-item">
					<button
						type="button"
						class="open"
						aria-describedby="{uid}-meta-{index}"
						disabled={busy}
						onclick={() => onOpen(situation)}
					>
						{situation.title}
					</button>
					<p id="{uid}-meta-{index}" class="meta">
						<span>{SavedSituationFormat.fieldType(situation.fieldType, $t)}</span>
						<span>
							{$t.saved.lastChangedBy(SavedSituationFormat.userName(situation.updatedBy, $t))}
							<time datetime={situation.updatedAt}>{SavedSituationFormat.dateTime(situation.updatedAt, $language)}</time>
						</span>
						<span>{$t.saved.createdBy(SavedSituationFormat.userName(situation.createdBy, $t))}</span>
					</p>
					{#if canChange}
						<button
							type="button"
							class="action move"
							aria-label={$t.saved.moveLabel(situation.title)}
							title={$t.saved.moveTitle}
							disabled={busy}
							onclick={() => onMove(situation)}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
								<path d="M10 13h6M13.5 10.5 16 13l-2.5 2.5" />
							</svg>
							<span class="action-label">{$t.common.move}</span>
						</button>
						<button
							type="button"
							class="action delete"
							aria-label={$t.saved.deleteLabel(situation.title)}
							title={$t.common.delete}
							disabled={busy}
							onclick={() => onDelete(situation)}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
								<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
							</svg>
							<span class="action-label">{$t.common.delete}</span>
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
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

	.retry,
	.action {
		min-height: var(--touch-target);
		min-width: var(--touch-target);
		padding: 0 12px;
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

	.saved-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.saved-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		grid-template-areas:
			"open move delete"
			"meta move delete";
		align-items: center;
		column-gap: 8px;
		padding: 8px 8px 8px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		box-shadow: inset 0 0 0 1px var(--border);
	}

	.open {
		grid-area: open;
		min-height: var(--touch-target);
		padding: 0;
		border: none;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 16px;
		font-weight: 600;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}

	.open:hover:not(:disabled) {
		color: var(--accent);
	}

	.meta {
		grid-area: meta;
		margin: 0 0 4px;
		display: flex;
		flex-wrap: wrap;
		gap: 2px 12px;
		font-size: 13px;
		color: var(--text-muted);
	}

	.move {
		grid-area: move;
	}

	.delete {
		grid-area: delete;
		color: var(--danger);
	}

	.open:focus-visible,
	.action:focus-visible,
	.retry:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 599px) {
		.action {
			padding: 0;
		}

		.action-label {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}
</style>
