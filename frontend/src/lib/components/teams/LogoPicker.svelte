<!--
@component
Choosing a logo image (arc42 ch. 8.17) inside a form: a button opens the
file picker (PNG, JPEG, WebP), the chosen image is previewed, and it can be
dropped again. A file of the wrong type or too large is refused at once
with the reason (`LogoChoice`). The state lives in the owner's `choice`.
-->
<script lang="ts">
	import { t } from "$lib/i18n";
	import { LogoChoice } from "$lib/teams/LogoChoice.svelte";

	interface Props {
		choice: LogoChoice;
		disabled?: boolean;
	}

	let { choice, disabled = false }: Props = $props();

	const uid = $props.id();
	let fileInput: HTMLInputElement;

	function handleChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = "";
		if (file) {
			choice.choose(file);
		}
	}
</script>

<fieldset class="logo-picker" aria-describedby="{uid}-hint">
	<legend class="modal-label">{$t.teams.logo}</legend>
	<p id="{uid}-hint" class="hint">{$t.teams.logoHint(LogoChoice.maxMegabytes)}</p>
	{#if choice.previewUrl}
		<img class="preview" src={choice.previewUrl} alt={$t.teams.logoPreview} width="96" height="96" />
	{/if}
	<div class="buttons">
		<button type="button" class="modal-btn secondary" {disabled} onclick={() => fileInput.click()}>
			{choice.file ? $t.teams.changeChosenLogo : $t.teams.chooseLogo}
		</button>
		{#if choice.file}
			<button type="button" class="modal-btn secondary" {disabled} onclick={() => choice.clear()}>{$t.teams.dropChosenLogo}</button>
		{/if}
	</div>
	<input bind:this={fileInput} type="file" accept={LogoChoice.ACCEPT} class="hidden-input" tabindex="-1" aria-hidden="true" onchange={handleChange} />
	{#if choice.problem}
		<p class="field-error" role="alert">{choice.problem($t)}</p>
	{/if}
</fieldset>

<style>
	.logo-picker {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--text-muted);
	}

	.preview {
		width: 96px;
		height: 96px;
		object-fit: contain;
		border-radius: var(--radius-sm);
		box-shadow: inset 0 0 0 1px var(--border);
		background: var(--bg-app);
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.field-error {
		margin: 0;
		font-size: 13px;
		color: var(--danger);
	}

	.hidden-input {
		display: none;
	}
</style>
