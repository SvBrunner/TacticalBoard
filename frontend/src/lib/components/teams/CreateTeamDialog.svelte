<!--
@component
Modal form "Create team" (arc42 ch. 8.17): the team's name and an optional
logo with a preview. Checks the input like the backend does (name not empty,
at most 64 characters, no control characters; logo PNG/JPEG/WebP up to 5 MB)
and shows the server's message if creating fails (e.g. the name is taken).
Starts empty every time it opens; Escape or Cancel closes without changes.
-->
<script lang="ts">
	import { untrack } from "svelte";
	import { modalDialog } from "$lib/actions/modalDialog";
	import { t } from "$lib/i18n";
	import type { Translatable } from "$lib/i18n/Messages";
	import { LogoChoice } from "$lib/teams/LogoChoice.svelte";
	import { TeamApi } from "$lib/teams/TeamApi";
	import { TeamNameForm } from "$lib/teams/TeamNameForm.svelte";
	import LogoPicker from "./LogoPicker.svelte";

	interface Props {
		open: boolean;
		/** Creates the team with the trimmed name and the chosen logo; a message when it failed. */
		onSubmit: (name: string, logo: File | null) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: Translatable }>;
		/** The dialog is done (created or cancelled); the owner closes it by flipping `open`. */
		onClose: () => void;
	}

	let { open, onSubmit, onClose }: Props = $props();

	const uid = $props.id();
	const form = new TeamNameForm();
	const logo = new LogoChoice();
	let input: HTMLInputElement | undefined = $state();

	// Starts empty whenever it opens (untracked: clearing reads the choice, which must not re-run this).
	$effect.pre(() => {
		if (open) {
			untrack(() => {
				form.reset("");
				logo.clear();
			});
		}
	});

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (form.saving || !form.attemptSubmit() || logo.problem) {
			input?.focus();
			return;
		}
		form.saving = true;
		const result = await onSubmit(form.trimmed, logo.file);
		form.saving = false;
		if (result.ok) {
			logo.clear();
			onClose();
		} else {
			form.serverError = result.message;
			input?.focus();
		}
	}

	function cancel() {
		if (!form.saving) {
			logo.clear();
			onClose();
		}
	}
</script>

<dialog class="modal-dialog" aria-labelledby="{uid}-title" use:modalDialog={{ open, onCancel: cancel, initialFocus: () => input }}>
	<form method="dialog" class="modal-form" novalidate onsubmit={handleSubmit}>
		<h2 id="{uid}-title" class="modal-title">{$t.teams.newHeading}</h2>

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

		<LogoPicker choice={logo} disabled={form.saving} />

		<div class="modal-actions">
			<button type="button" class="modal-btn secondary" onclick={cancel} disabled={form.saving}>{$t.common.cancel}</button>
			<button type="submit" class="modal-btn primary" disabled={form.saving}>{$t.common.create}</button>
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
