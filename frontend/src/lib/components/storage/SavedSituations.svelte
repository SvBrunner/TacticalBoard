<!--
@component
The saved situations of one place of the personal area (arc42 ch. 8.15): the
top level on the start page, or a folder on its page. Each with title, field
type, last changed by/at and created by; a situation opens with its title
button, Move offers the other folders of the area (`onMove` opens the
picker), and Delete deletes it (the owner asks for confirmation). Without
login a hint to log in; without a server a hint that local mode works as
usual.
-->
<script lang="ts">
	import type { SessionState } from "$lib/auth/AuthSession";
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
		/** Shown when the place has no situations. */
		emptyMessage?: string;
		/** Disables the buttons (e.g. while a situation is being opened). */
		busy?: boolean;
	}

	let {
		session,
		list,
		onOpen,
		onDelete,
		onMove,
		onRetry,
		emptyMessage = "No saved situations yet. Create or import one and save it in the editor.",
		busy = false,
	}: Props = $props();

	const uid = $props.id();
</script>

{#if session.status === "anonymous"}
	<p class="hint">Log in to save situations on the server and find them here.</p>
{:else if session.status === "unavailable"}
	<p class="hint">Saved situations need the server, which can't be reached. Creating, editing, export and import work as usual.</p>
{:else if session.status === "authenticated"}
	{#if list.status === "loading" || list.status === "idle"}
		<p class="hint" role="status">Loading saved situations…</p>
	{:else if list.status === "failed"}
		<div class="failure" role="alert">
			<p class="hint">{list.message}</p>
			<button type="button" class="retry" onclick={onRetry}>Try again</button>
		</div>
	{:else if list.situations.length === 0}
		<p class="hint">{emptyMessage}</p>
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
						<span>{SavedSituationFormat.fieldType(situation.fieldType)}</span>
						<span>
							Last changed by {SavedSituationFormat.userName(situation.updatedBy)},
							<time datetime={situation.updatedAt}>{SavedSituationFormat.dateTime(situation.updatedAt)}</time>
						</span>
						<span>Created by {SavedSituationFormat.userName(situation.createdBy)}</span>
					</p>
					<button
						type="button"
						class="action move"
						aria-label="Move “{situation.title}”"
						title="Move to another folder"
						disabled={busy}
						onclick={() => onMove(situation)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
							<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
							<path d="M10 13h6M13.5 10.5 16 13l-2.5 2.5" />
						</svg>
						<span class="action-label">Move</span>
					</button>
					<button
						type="button"
						class="action delete"
						aria-label="Delete “{situation.title}”"
						title="Delete"
						disabled={busy}
						onclick={() => onDelete(situation)}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
							<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
						</svg>
						<span class="action-label">Delete</span>
					</button>
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
