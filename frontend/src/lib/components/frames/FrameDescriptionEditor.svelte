<!--
@component
Edits the active frame's description as Markdown source (no rendering).
Every input is reported through `onChange`; leaving the field ends the edit
session (`onCommit`), so one focus of the field is one undo step. Shows the
new frame's text when the active frame changes.
-->
<script lang="ts">
	interface Props {
		/** 1-based position of the active frame, shown in the label. */
		frameNumber: number;
		description: string;
		onChange: (description: string) => void;
		/** The edit session ended (the field lost focus). */
		onCommit: () => void;
	}

	let { frameNumber, description, onChange, onCommit }: Props = $props();

	const uid = $props.id();
</script>

<div class="text-field">
	<label class="text-label" for="{uid}-frame-description">Frame {frameNumber} description</label>
	<textarea
		id="{uid}-frame-description"
		class="text-input"
		rows="4"
		placeholder="What happens in this frame? (Markdown)"
		value={description}
		oninput={(event) => onChange(event.currentTarget.value)}
		onblur={onCommit}
	></textarea>
</div>
