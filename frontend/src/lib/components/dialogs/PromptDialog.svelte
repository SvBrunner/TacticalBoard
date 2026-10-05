<!--
@component
Shows the questions of a `ConfirmationPrompt` (e.g. "Discard changes?",
"Delete situation?") in the shared `ConfirmDialog`, worded in the UI
language; Confirm answers yes, Cancel or Escape no. Render one per prompt.
-->
<script lang="ts">
	import type { ConfirmationPrompt } from "$lib/dialogs/ConfirmationPrompt";
	import { t } from "$lib/i18n";
	import ConfirmDialog from "./ConfirmDialog.svelte";

	interface Props {
		prompt: ConfirmationPrompt;
	}

	let { prompt }: Props = $props();

	const question = $derived(prompt.pending);
</script>

<ConfirmDialog
	open={$question !== null}
	title={$question?.title($t) ?? ""}
	message={$question?.message($t) ?? ""}
	confirmLabel={$question?.confirmLabel($t) ?? $t.common.ok}
	cancelLabel={$question?.cancelLabel?.($t)}
	onConfirm={() => prompt.answer(true)}
	onCancel={() => prompt.answer(false)}
/>
