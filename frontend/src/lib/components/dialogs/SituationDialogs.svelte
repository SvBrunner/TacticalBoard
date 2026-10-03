<!--
@component
The dialogs around starting a situation, shared by the start page and the
editor: "Discard changes?" when unsaved changes would be lost, and the
"New situation" form. Call `startNew()` or `importFile(file)` on the
instance (`bind:this`); `onOpened` runs once a situation was created or
imported.
-->
<script lang="ts">
	import type { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import type { NewSituationInput } from "$lib/editor/SituationEditor";
	import type { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import ConfirmDialog from "./ConfirmDialog.svelte";
	import NewSituationDialog from "./NewSituationDialog.svelte";

	interface Props {
		workflow: Pick<SituationWorkflow, "confirmDiscardIfDirty" | "createNew" | "importFile">;
		/** The prompt the workflow asks its questions through. */
		prompt: ConfirmationPrompt;
		onOpened: () => void;
	}

	let { workflow, prompt, onOpened }: Props = $props();

	const question = $derived(prompt.pending);
	let newSituationOpen = $state(false);

	/** Asks to discard unsaved changes if needed, then shows the "New situation" form. */
	export async function startNew(): Promise<void> {
		if (await workflow.confirmDiscardIfDirty()) {
			newSituationOpen = true;
		}
	}

	/** Imports the file (asking to discard unsaved changes if needed). */
	export async function importFile(file: File): Promise<void> {
		if (await workflow.importFile(file)) {
			onOpened();
		}
	}

	function create(input: NewSituationInput) {
		newSituationOpen = false;
		workflow.createNew(input);
		onOpened();
	}
</script>

<ConfirmDialog
	open={$question !== null}
	title={$question?.title ?? ""}
	message={$question?.message ?? ""}
	confirmLabel={$question?.confirmLabel ?? "OK"}
	cancelLabel={$question?.cancelLabel}
	onConfirm={() => prompt.answer(true)}
	onCancel={() => prompt.answer(false)}
/>

<NewSituationDialog open={newSituationOpen} onCreate={create} onCancel={() => (newSituationOpen = false)} />
