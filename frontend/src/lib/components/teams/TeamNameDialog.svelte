<!--
@component
Modal form "Rename team" (arc42 ch. 8.17), for the team's Admins. Starts
with the current name every time it opens; checks it like the backend does
and shows the server's message if renaming fails (e.g. the name is taken).
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import { t } from "$lib/i18n";
	import type { Translatable } from "$lib/i18n/Messages";
	import { TeamApi } from "$lib/teams/TeamApi";
	import { TeamNameForm } from "$lib/teams/TeamNameForm.svelte";

	interface Props {
		open: boolean;
		initialName: string;
		/** Renames with the trimmed name; a message when it failed. */
		onSubmit: (name: string) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: Translatable }>;
		onClose: () => void;
	}

	let { open, initialName, onSubmit, onClose }: Props = $props();

	const uid = $props.id();
	const form = new TeamNameForm();
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
		<h2 id="{uid}-title" class="modal-title">{$t.teams.renameHeading}</h2>

		<p class="modal-field">
			<label for="{uid}-name" class="modal-label">{$t.teams.name}</label>
			<input
				bind:this={input}
				id="{uid}-name"
				class="modal-input"
				type="text"
				name="teamName"
				autocomplete="off"
				required
				maxlength={TeamApi.MAX_NAME_LENGTH}
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
			<button type="submit" class="modal-btn primary" disabled={form.saving}>{$t.common.rename}</button>
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
