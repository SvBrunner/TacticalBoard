<!--
@component
Reusable modal yes/no question (native `<dialog>`, an alert dialog). Focus
starts on Cancel (the safe choice); Escape cancels. The owner opens and
closes it through `open`.
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import { t } from "$lib/i18n";

	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		/** Defaults to "Cancel" in the current language. */
		cancelLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let { open, title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props = $props();

	const uid = $props.id();
	let cancelButton: HTMLButtonElement | undefined = $state();

	function handleSubmit(event: SubmitEvent) {
		// The owner closes the dialog by flipping `open`.
		event.preventDefault();
		onConfirm();
	}
</script>

<dialog
	class="modal-dialog"
	role="alertdialog"
	aria-labelledby="{uid}-title"
	aria-describedby="{uid}-message"
	use:modalDialog={{ open, onCancel, initialFocus: () => cancelButton }}
>
	<form method="dialog" class="modal-form" onsubmit={handleSubmit}>
		<h2 id="{uid}-title" class="modal-title">{title}</h2>
		<p id="{uid}-message" class="modal-text">{message}</p>
		<div class="modal-actions">
			<button bind:this={cancelButton} type="button" class="modal-btn secondary" onclick={onCancel}>{cancelLabel ?? $t.common.cancel}</button>
			<button type="submit" class="modal-btn danger">{confirmLabel}</button>
		</div>
	</form>
</dialog>
