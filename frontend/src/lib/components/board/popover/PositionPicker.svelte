<!--
@component
Position label of a player: one radio chip per predefined position of the
sport plus "None", and a free-text field for anything else (up to two
letters or digits, e.g. a jersey number). Typed text is normalized (letters
upper-cased, other characters dropped) as you type. All keystrokes of one
focus of the text field are a single undo step; picking a chip is a step of
its own.
-->
<script lang="ts">
	import type { PointElement } from "$lib/model/elements/PointElement";
	import { PositionCatalog } from "$lib/model/positions/PositionCatalog";
	import { t } from "$lib/i18n";
	import type { ElementEditActions } from "./ElementEditActions";

	interface Props {
		/** The player whose label is edited. */
		element: PointElement;
		positions: PositionCatalog;
		actions: Pick<ElementEditActions, "changeLabel" | "endGesture">;
	}

	let { element, positions, actions }: Props = $props();

	const uid = $props.id();
	const groupName = `position-${uid}`;
	const inputId = `position-text-${uid}`;
	const hintId = `position-hint-${uid}`;

	const elementId = $derived(element.id);

	// End the text edit session when the picker closes or switches to
	// another element (a removed input doesn't reliably fire blur).
	$effect(() => {
		void elementId;
		return () => actions.endGesture();
	});

	function pick(label: string) {
		actions.changeLabel(element.id, label);
		actions.endGesture();
	}

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget;
		const label = PositionCatalog.normalize(input.value);
		if (input.value !== label) {
			input.value = label;
		}
		actions.changeLabel(element.id, label);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			actions.endGesture();
		}
	}
</script>

<fieldset class="position-picker">
	<legend class="section-title">{$t.popover.position}</legend>
	<ul class="chips">
		<li class="none">
			<label class="chip">
				<input type="radio" name={groupName} value="" checked={element.label === ""} onchange={() => pick("")} />
				<span>{$t.popover.noPosition}</span>
			</label>
		</li>
		{#each positions.positions as position (position.code)}
			<li>
				<label class="chip" title={positions.nameOf(position.code, $t.positions)}>
					<input
						type="radio"
						name={groupName}
						value={position.code}
						checked={element.label === position.code}
						onchange={() => pick(position.code)}
					/>
					<span>{position.code}</span> <span class="visually-hidden">({positions.nameOf(position.code, $t.positions)})</span>
				</label>
			</li>
		{/each}
	</ul>

	<p class="custom">
		<label for={inputId}>{$t.popover.customPosition}</label>
		<input
			id={inputId}
			type="text"
			value={element.label}
			maxlength={PositionCatalog.MAX_LABEL_LENGTH}
			autocomplete="off"
			autocapitalize="characters"
			spellcheck="false"
			enterkeyhint="done"
			aria-describedby={hintId}
			oninput={handleInput}
			onblur={() => actions.endGesture()}
			onkeydown={handleKeydown}
		/>
	</p>
	<p id={hintId} class="hint">{$t.popover.positionHint(PositionCatalog.MAX_LABEL_LENGTH)}</p>
</fieldset>

<style>
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	.section-title {
		padding: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin-bottom: 10px;
	}

	.chips {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(var(--touch-target), 1fr));
		gap: 6px;
	}

	.none {
		grid-column: span 2;
	}

	.chip {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: var(--touch-target);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		touch-action: manipulation;
	}

	/* The native radio stays in the accessibility tree and keyboard order; the chip is its visual. */
	.chip input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.chip:has(input:checked) {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: var(--accent);
	}

	.chip:has(input:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.custom {
		margin: 10px 0 0;
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 13px;
	}

	.custom input {
		width: 4.5em;
		min-height: var(--touch-target);
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text);
		/* 16px keeps iOS from zooming in on focus. */
		font: inherit;
		font-size: 16px;
		font-weight: 600;
		text-align: center;
	}

	.hint {
		margin: 4px 0 0;
		font-size: 11px;
		color: var(--text-muted);
	}
</style>
