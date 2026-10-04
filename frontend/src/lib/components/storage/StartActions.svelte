<!--
@component
"New situation" and "Import" (arc42 ch. 8.8), started at a place of the
personal area: on the start page its top level, on a folder's page that
folder — so the first save of the situation goes there (ch. 8.15). Both
lead into the editor (`onOpened`). Includes the dialogs around starting a
situation (`SituationDialogs`: "Discard changes?", the New situation form),
which also show the questions of `prompt`.
-->
<script lang="ts">
	import SituationDialogs from "$lib/components/dialogs/SituationDialogs.svelte";
	import type { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import type { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";

	interface Props {
		workflow: Pick<SituationWorkflow, "confirmDiscardIfDirty" | "createNew" | "importFile">;
		prompt: ConfirmationPrompt;
		/** Where the started situation is saved on its first save. */
		target?: SaveTarget;
		onOpened: () => void;
	}

	let { workflow, prompt, target = TOP_LEVEL, onOpened }: Props = $props();

	let dialogs: SituationDialogs;
	let fileInput: HTMLInputElement;

	function handleFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = "";
		if (file) {
			void dialogs.importFile(file);
		}
	}
</script>

<ul class="actions">
	<li>
		<button type="button" class="action primary" onclick={() => dialogs.startNew()}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M12 5v14M5 12h14" />
			</svg>
			New situation
		</button>
	</li>
	<li>
		<button type="button" class="action" onclick={() => fileInput.click()}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M12 15V3M7 8l5-5 5 5" />
				<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
			</svg>
			Import
		</button>
		<input bind:this={fileInput} type="file" accept=".json" class="hidden-input" onchange={handleFileChange} />
	</li>
</ul>

<SituationDialogs bind:this={dialogs} {workflow} {prompt} {target} {onOpened} />

<style>
	.actions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 12px;
	}

	.action {
		width: 100%;
		min-height: 72px;
		padding: 0 20px;
		display: flex;
		align-items: center;
		gap: 12px;
		border: none;
		border-radius: var(--radius-md);
		background: var(--bg-app);
		color: var(--text);
		box-shadow: inset 0 0 0 1px var(--border);
		font-size: 16px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}

	.action.primary {
		background: var(--accent);
		color: var(--accent-contrast);
		box-shadow: none;
	}

	.action:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.hidden-input {
		display: none;
	}
</style>
