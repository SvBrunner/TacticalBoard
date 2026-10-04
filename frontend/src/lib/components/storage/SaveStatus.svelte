<!--
@component
Feedback of saving on the server in the editor: a failure (e.g. a taken
title) is shown as an alert below the header until it is dismissed or the
next save starts; "Saving…" and "Saved" are announced politely to assistive
technology (the Save button and the cleared unsaved-changes state show it
visually).
-->
<script lang="ts">
	import { t } from "$lib/i18n";
	import type { SaveState } from "$lib/storage/SituationSaver";

	interface Props {
		state: SaveState;
		onDismiss: () => void;
	}

	let { state, onDismiss }: Props = $props();

	const announcement = $derived(
		state.status === "saving" ? $t.editor.saving : state.status === "saved" ? $t.saving.saved(state.title) : "",
	);
</script>

<p class="visually-hidden" role="status">{announcement}</p>

{#if state.status === "failed"}
	<div class="save-error" role="alert">
		<p class="message">{state.message($t)}</p>
		<button type="button" class="dismiss" onclick={onDismiss}>{$t.common.dismiss}</button>
	</div>
{/if}

<style>
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	.save-error {
		position: absolute;
		top: calc(100% + 8px);
		left: 50%;
		transform: translateX(-50%);
		z-index: 4;
		width: min(560px, calc(100vw - 32px));
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 8px 8px 16px;
		border-radius: var(--radius-md);
		background: var(--bg-surface);
		color: var(--text);
		border: 1px solid var(--danger);
		box-shadow: var(--shadow);
	}

	.message {
		flex: 1;
		margin: 0;
		font-size: 14px;
		line-height: 1.4;
	}

	.dismiss {
		min-height: var(--touch-target);
		padding: 0 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--bg-app);
		color: var(--text);
		font: inherit;
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
	}

	.dismiss:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
