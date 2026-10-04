<!--
@component
Modal form for a folder's name, used for "New folder" and "Rename folder"
(arc42 ch. 8.15). Starts with `initialName` every time it opens; focus starts
in the field. Submitting checks the input like the backend does (not empty,
at most 100 characters, no control characters) and shows the server's
message if it fails (e.g. the name is taken); Escape or Cancel closes
without changes.
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import { t } from "$lib/i18n";
	import type { Translatable } from "$lib/i18n/Messages";
	import { FolderApi } from "$lib/storage/FolderApi";
	import { FolderNameForm } from "$lib/storage/FolderNameForm.svelte";

	interface Props {
		open: boolean;
		/** The dialog's heading, e.g. "New folder". */
		title: string;
		/** The submit button, e.g. "Create". */
		submitLabel: string;
		initialName?: string;
		/** Creates or renames with the trimmed name; a message when it failed. */
		onSubmit: (name: string) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: Translatable }>;
		/** The dialog is done (submitted or cancelled); the owner closes it by flipping `open`. */
		onClose: () => void;
	}

	let { open, title, submitLabel, initialName = "", onSubmit, onClose }: Props = $props();

	const uid = $props.id();
	const form = new FolderNameForm();
	let input: HTMLInputElement | undefined = $state();

	$effect.pre(() => {
		if (open) {
			form.reset(initialName);
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (form.saving || !form.attemptSubmit()) {
			input?.focus();
			return;
		}
		form.saving = true;
		const result = await onSubmit(form.trimmed);
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
		<h2 id="{uid}-title" class="modal-title">{title}</h2>

		<p class="modal-field">
			<label for="{uid}-name" class="modal-label">{$t.folders.name}</label>
			<input
				bind:this={input}
				id="{uid}-name"
				class="modal-input"
				type="text"
				name="folderName"
				autocomplete="off"
				required
				maxlength={FolderApi.MAX_NAME_LENGTH}
				aria-invalid={form.message !== null}
				aria-describedby={form.message ? `${uid}-error` : undefined}
				bind:value={form.value}
				oninput={() => form.edited()}
			/>
		</p>
		{#if form.message}
			<p id="{uid}-error" class="field-error" role="alert">{form.message($t)}</p>
		{/if}

		<div class="modal-actions">
			<button type="button" class="modal-btn secondary" onclick={cancel} disabled={form.saving}>{$t.common.cancel}</button>
			<button type="submit" class="modal-btn primary" disabled={form.saving}>{submitLabel}</button>
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
