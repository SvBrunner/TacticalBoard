<!--
@component
Modal form for a new situation: title (optional; a blank title becomes the
default title) and full or half field. Resets to the defaults every time it
opens; focus starts in the title field. Enter or Create submits, Escape or
Cancel cancels. The owner opens and closes it through `open`.
-->
<script lang="ts">
	import { modalDialog } from "$lib/actions/modalDialog";
	import { NewSituationForm } from "$lib/editor/NewSituationForm.svelte";
	import type { NewSituationInput } from "$lib/editor/SituationEditor";

	interface Props {
		open: boolean;
		onCreate: (input: NewSituationInput) => void;
		onCancel: () => void;
	}

	let { open, onCreate, onCancel }: Props = $props();

	const uid = $props.id();
	const form = new NewSituationForm();
	let titleInput: HTMLInputElement | undefined = $state();

	// Every opening starts from the defaults. Runs before the dialog action
	// opens the dialog, so focus and values are right from the start.
	$effect.pre(() => {
		if (open) {
			form.reset();
		}
	});

	function handleSubmit(event: SubmitEvent) {
		// The owner closes the dialog by flipping `open`.
		event.preventDefault();
		if (form.isValid) {
			onCreate(form.toInput());
		}
	}
</script>

<dialog
	class="modal-dialog"
	aria-labelledby="{uid}-title"
	use:modalDialog={{ open, onCancel, initialFocus: () => titleInput }}
>
	<form method="dialog" class="modal-form" onsubmit={handleSubmit}>
		<h2 id="{uid}-title" class="modal-title">New situation</h2>

		<p class="modal-field">
			<label for="{uid}-name" class="modal-label">Title</label>
			<input
				bind:this={titleInput}
				id="{uid}-name"
				class="modal-input"
				type="text"
				name="title"
				autocomplete="off"
				placeholder={NewSituationForm.titlePlaceholder}
				bind:value={form.title}
			/>
		</p>

		<fieldset class="modal-fieldset">
			<legend class="modal-label">Field</legend>
			<ul class="choices">
				{#each NewSituationForm.fieldTypeOptions as option (option.value)}
					<li>
						<label class="choice">
							<input type="radio" name="fieldType" value={option.value} bind:group={form.fieldType} />
							<span>{option.label}</span>
						</label>
					</li>
				{/each}
			</ul>
		</fieldset>

		<div class="modal-actions">
			<button type="button" class="modal-btn secondary" onclick={onCancel}>Cancel</button>
			<button type="submit" class="modal-btn primary">Create</button>
		</div>
	</form>
</dialog>

<style>
	.choices {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.choice {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--touch-target);
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 14px;
	}

	.choice:has(input:checked) {
		border-color: var(--accent);
		background: var(--accent-soft);
	}

	.choice input {
		width: 18px;
		height: 18px;
		margin: 0;
		accent-color: var(--accent);
	}
</style>
