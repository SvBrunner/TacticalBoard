<!--
@component
The dialogs around starting a situation, shared by the start page and the
editor: "Discard changes?" when unsaved changes would be lost, and the
"New situation" form. Call `startNew()` or `importFile(file)` on the
instance (`bind:this`); `onOpened` runs once a situation was created or
imported. Its first save on the server goes to `target` (default: the top
level of the personal area).
-->
<script lang="ts">
	import type { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import type { NewSituationInput } from "$lib/editor/SituationEditor";
	import type { SituationWorkflow } from "$lib/editor/SituationWorkflow";
	import { TOP_LEVEL, type SaveTarget } from "$lib/storage/SaveTarget";
	import NewSituationDialog from "./NewSituationDialog.svelte";
	import PromptDialog from "./PromptDialog.svelte";

	interface Props {
		workflow: Pick<SituationWorkflow, "confirmDiscardIfDirty" | "createNew" | "importFile">;
		/** The prompt the workflow asks its questions through. */
		prompt: ConfirmationPrompt;
		/** Where a created or imported situation is saved on its first save. */
		target?: SaveTarget;
		onOpened: () => void;
	}

	let { workflow, prompt, target = TOP_LEVEL, onOpened }: Props = $props();

	let newSituationOpen = $state(false);

	/** Asks to discard unsaved changes if needed, then shows the "New situation" form. */
	export async function startNew(): Promise<void> {
		if (await workflow.confirmDiscardIfDirty()) {
			newSituationOpen = true;
		}
	}

	/** Imports the file (asking to discard unsaved changes if needed). */
	export async function importFile(file: File): Promise<void> {
		if (await workflow.importFile(file, target)) {
			onOpened();
		}
	}

	function create(input: NewSituationInput) {
		newSituationOpen = false;
		workflow.createNew(input, target);
		onOpened();
	}
</script>

<PromptDialog {prompt} />

<NewSituationDialog open={newSituationOpen} onCreate={create} onCancel={() => (newSituationOpen = false)} />
