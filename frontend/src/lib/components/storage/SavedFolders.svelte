<!--
@component
The folders of the personal area on the start page (arc42 ch. 8.15): each a
link to its own page (`/folders/<id>`, deep-linkable), in the server's order
(by name). Shows loading, a failure with "Try again", or "No folders yet.".
-->
<script lang="ts">
	import type { FolderListState } from "$lib/storage/FolderList";
	import { FolderRoute } from "$lib/storage/FolderRoute";

	interface Props {
		list: FolderListState;
		onRetry: () => void;
	}

	let { list, onRetry }: Props = $props();
</script>

{#if list.status === "loading" || list.status === "idle"}
	<p class="hint" role="status">Loading folders…</p>
{:else if list.status === "failed"}
	<div class="failure" role="alert">
		<p class="hint">{list.message}</p>
		<button type="button" class="retry" onclick={onRetry}>Try again</button>
	</div>
{:else if list.folders.length === 0}
	<p class="hint">No folders yet.</p>
{:else}
	<ul class="folder-list">
		{#each list.folders as folder (folder.id)}
			<li>
				<a class="folder" href={FolderRoute.forFolder(folder.id)}>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
						<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
					</svg>
					<span class="name">{folder.name}</span>
				</a>
			</li>
		{/each}
	</ul>
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

	.folder-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 8px;
	}

	.folder {
		min-height: var(--touch-target);
		padding: 8px 16px;
		display: flex;
		align-items: center;
		gap: 10px;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		box-shadow: inset 0 0 0 1px var(--border);
		color: var(--text);
		font-size: 16px;
		font-weight: 600;
		text-decoration: none;
	}

	.folder svg {
		flex: none;
		color: var(--accent);
	}

	.name {
		overflow-wrap: anywhere;
	}

	.folder:hover {
		color: var(--accent);
	}

	.folder:focus-visible,
	.retry:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
