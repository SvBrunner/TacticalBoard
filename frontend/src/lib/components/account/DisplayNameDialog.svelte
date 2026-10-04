<!--
@component
Modal form to change the display name. Starts with the current name every
time it opens; focus starts in the field. Save checks the input like the
backend does (not empty, at most 100 characters) and shows the server's
message if saving fails; Escape or Cancel closes without saving.
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import type { DisplayNameChange } from "$lib/auth/AuthSession";
	import { DisplayNameForm } from "$lib/auth/DisplayNameForm.svelte";

	interface Props {
		open: boolean;
		currentName: string;
		/** Saves the (trimmed) name. */
		onSave: (displayName: string) => Promise<DisplayNameChange>;
		/** The dialog is done (saved or cancelled); the owner closes it by flipping `open`. */
		onClose: () => void;
	}

	let { open, currentName, onSave, onClose }: Props = $props();

	const uid = $props.id();
	const form = new DisplayNameForm();
	let input: HTMLInputElement | undefined = $state();

	$effect.pre(() => {
		if (open) {
			form.reset(currentName);
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (form.saving || !form.attemptSubmit()) {
			input?.focus();
			return;
		}
		form.saving = true;
		const result = await onSave(form.trimmed);
		form.saving = false;
		if (result.ok) {
			onClose();
		} else {
			form.serverError = result.message;
			input?.focus();
		}
	}

	function cancel() {
		if (!form.saving) {
			onClose();
		}
	}
</script>

<dialog class="modal-dialog" aria-labelledby="{uid}-title" use:modalDialog={{ open, onCancel: cancel, initialFocus: () => input }}>
	<form method="dialog" class="modal-form" novalidate onsubmit={handleSubmit}>
		<h2 id="{uid}-title" class="modal-title">Change display name</h2>

		<p class="modal-field">
			<label for="{uid}-name" class="modal-label">Display name</label>
			<input
				bind:this={input}
				id="{uid}-name"
				class="modal-input"
				type="text"
				name="displayName"
				autocomplete="nickname"
				required
				maxlength={DisplayNameForm.MAX_LENGTH}
				aria-invalid={form.message !== null}
				aria-describedby={form.message ? `${uid}-error` : undefined}
				bind:value={form.value}
				oninput={() => form.edited()}
			/>
		</p>
		{#if form.message}
			<p id="{uid}-error" class="field-error" role="alert">{form.message}</p>
		{/if}

		<div class="modal-actions">
			<button type="button" class="modal-btn secondary" onclick={cancel} disabled={form.saving}>Cancel</button>
			<button type="submit" class="modal-btn primary" disabled={form.saving}>Save</button>
		</div>
	</form>
</dialog>

<style>
	.field-error {
		margin: -12px 0 0;
		font-size: 13px;
		color: var(--danger);
	}

	.modal-input[aria-invalid="true"] {
		border-color: var(--danger);
	}
</style>
