<!--
@component
Asked when a save fails because someone else saved the situation in the
meantime (arc42 ch. 8.15): Overwrite (save on top of their version), Save as
copy (a new situation with " (2)" or the next free number), or Cancel. Focus
starts on Cancel (the safe choice); Escape cancels.
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import { t } from "$lib/i18n";
	import type { ConflictChoice } from "$lib/storage/SituationSaver";

	interface Props {
		open: boolean;
		onChoose: (choice: ConflictChoice) => void;
	}

	let { open, onChoose }: Props = $props();

	const uid = $props.id();
	let cancelButton: HTMLButtonElement | undefined = $state();
</script>

<dialog
	class="modal-dialog"
	role="alertdialog"
	aria-labelledby="{uid}-title"
	aria-describedby="{uid}-message"
	use:modalDialog={{ open, onCancel: () => onChoose("cancel"), initialFocus: () => cancelButton }}
>
	<div class="modal-form">
		<h2 id="{uid}-title" class="modal-title">{$t.conflict.heading}</h2>
		<p id="{uid}-message" class="modal-text">{$t.conflict.message}</p>
		<div class="modal-actions">
			<button bind:this={cancelButton} type="button" class="modal-btn secondary" onclick={() => onChoose("cancel")}>{$t.common.cancel}</button>
			<button type="button" class="modal-btn secondary" onclick={() => onChoose("copy")}>{$t.conflict.saveAsCopy}</button>
			<button type="button" class="modal-btn danger" onclick={() => onChoose("overwrite")}>{$t.conflict.overwrite}</button>
		</div>
	</div>
</dialog>
