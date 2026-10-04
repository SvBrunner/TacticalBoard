<!--
@component
"Move to…" for a saved situation (arc42 ch. 8.15): a modal form listing the
places of its area — the top level and every folder — as radio buttons
(touch-friendly, ≥ 44 px), with its current place preselected, marked and
focused.
Move is enabled once another place is chosen; Escape or Cancel closes
without moving. The owner opens it with the situation and closes it by
setting `situation` back to `null`.
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import { t } from "$lib/i18n";
	import type { Folder } from "$lib/storage/FolderApi";
	import type { SituationSummary } from "$lib/storage/SituationApi";

	interface Props {
		/** The situation to move; `null` closes the dialog. */
		situation: SituationSummary | null;
		/** The folders of its area, in the order to show them. */
		folders: readonly Folder[];
		/** Moves it into the folder (or `null`: the top level). */
		onMove: (situation: SituationSummary, folderId: string | null) => void;
		onCancel: () => void;
	}

	let { situation, folders, onMove, onCancel }: Props = $props();

	/** The radio value of the top level (folder ids are UUIDs, so it can't clash). */
	const TOP_LEVEL = "top-level";

	const uid = $props.id();
	const open = $derived(situation !== null);
	const current = $derived(situation?.folderId ?? TOP_LEVEL);
	let chosen = $state(TOP_LEVEL);
	let placeList: HTMLUListElement | undefined = $state();

	const places = $derived([
		{ value: TOP_LEVEL, label: $t.moveDialog.topLevel },
		...folders.map((folder) => ({ value: folder.id, label: folder.name })),
	]);

	$effect.pre(() => {
		if (situation) {
			chosen = situation.folderId ?? TOP_LEVEL;
		}
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (situation && chosen !== current) {
			onMove(situation, chosen === TOP_LEVEL ? null : chosen);
		}
	}
</script>

<dialog
	class="modal-dialog"
	aria-labelledby="{uid}-title"
	use:modalDialog={{ open, onCancel, initialFocus: () => placeList?.querySelector<HTMLInputElement>("input:checked") }}
>
	<form method="dialog" class="modal-form" onsubmit={handleSubmit}>
		<h2 id="{uid}-title" class="modal-title">{$t.moveDialog.heading(situation?.title ?? "")}</h2>

		<fieldset class="modal-fieldset">
			<legend class="modal-label">{$t.moveDialog.moveTo}</legend>
			<ul class="places" bind:this={placeList}>
				{#each places as place (place.value)}
					<li>
						<label class="place">
							<input type="radio" name="{uid}-place" value={place.value} bind:group={chosen} />
							<span class="place-name">{place.label}</span>
							{#if place.value === current}
								<span class="current">{$t.moveDialog.current}</span>
							{/if}
						</label>
					</li>
				{/each}
			</ul>
			{#if folders.length === 0}
				<p class="modal-text">{$t.moveDialog.noFolders}</p>
			{/if}
		</fieldset>

		<div class="modal-actions">
			<button type="button" class="modal-btn secondary" onclick={onCancel}>{$t.common.cancel}</button>
			<button type="submit" class="modal-btn primary" disabled={chosen === current}>{$t.common.move}</button>
		</div>
	</form>
</dialog>

<style>
	.places {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: min(50dvh, 360px);
		overflow-y: auto;
	}

	.place {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--touch-target);
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 14px;
	}

	.place:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.place input {
		flex: none;
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--accent);
	}

	.place-name {
		overflow-wrap: anywhere;
	}

	.current {
		margin-left: auto;
		color: var(--text-muted);
		font-size: 13px;
	}

	.modal-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
