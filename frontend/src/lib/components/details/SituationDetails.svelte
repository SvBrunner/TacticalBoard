<!--
@component
The details panel: the situation's title and description (Markdown
source), plus whatever the owner adds below (e.g. the frame description).
A side panel on desktops, a panel below the field on portrait tablets; on
phones it collapses to a "Details" disclosure button (collapsed by default)
so the field keeps the space. `disabled` (during playback) makes the
fields read-only (disabled). Edits are reported on every input; they aren't undoable steps, so
the fields' own (browser) undo applies while typing.
-->
<script lang="ts">
	import type { Snippet } from "svelte";
	import { t } from "$lib/i18n";

	interface Props {
		title: string;
		description: string;
		onTitleChange: (title: string) => void;
		onDescriptionChange: (description: string) => void;
		/** Shown in the title field when the title is blank. */
		titlePlaceholder?: string;
		/** The fields can't be edited (e.g. during playback). */
		disabled?: boolean;
		children?: Snippet;
	}

	let {
		title,
		description,
		onTitleChange,
		onDescriptionChange,
		titlePlaceholder = "",
		disabled = false,
		children,
	}: Props = $props();

	const uid = $props.id();
	/** Only matters on phones; on larger screens the content is always shown. */
	let expanded = $state(false);
</script>

<aside class="details-panel" class:expanded aria-labelledby="{uid}-heading">
	<h2 id="{uid}-heading" class="heading">{$t.details.heading}</h2>
	<button
		type="button"
		class="toggle"
		aria-expanded={expanded}
		aria-controls="{uid}-content"
		onclick={() => (expanded = !expanded)}
	>
		<span>{$t.details.heading}</span>
		<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" /></svg>
	</button>

	<div id="{uid}-content" class="content">
		<div class="text-field">
			<label class="text-label" for="{uid}-title">{$t.details.title}</label>
			<input
				id="{uid}-title"
				class="text-input"
				type="text"
				autocomplete="off"
				placeholder={titlePlaceholder}
				value={title}
				{disabled}
				oninput={(event) => onTitleChange(event.currentTarget.value)}
			/>
		</div>
		<div class="text-field">
			<label class="text-label" for="{uid}-description">{$t.details.description}</label>
			<textarea
				id="{uid}-description"
				class="text-input"
				rows="5"
				placeholder={$t.details.descriptionPlaceholder}
				value={description}
				{disabled}
				oninput={(event) => onDescriptionChange(event.currentTarget.value)}
			></textarea>
		</div>
		{@render children?.()}
	</div>
</aside>

<style>
	.details-panel {
		width: 280px;
		flex-shrink: 0;
		min-height: 0;
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		padding-right: calc(16px + env(safe-area-inset-right, 0px));
		overflow-y: auto;
		background: var(--bg-surface);
		position: relative;
		z-index: 1;
		box-shadow:
			-1px 0 0 var(--border),
			-6px 0 16px -12px oklch(20% 0.02 260 / 0.3);
	}

	.heading {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}

	/* Only phones collapse the panel. */
	.toggle {
		display: none;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	/* Tablets in portrait (and similar windows): a panel below the field, fields side by side. */
	@media (min-width: 600px) and (max-width: 1023px) and (min-height: 500px) {
		.details-panel {
			width: auto;
			max-height: 40dvh;
			gap: 12px;
			padding: 12px 16px;
			padding-right: calc(16px + env(safe-area-inset-right, 0px));
			box-shadow: 0 -1px 0 var(--border);
		}

		.content {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 12px 16px;
		}
	}

	/* Phones: a collapsible bar above the field. */
	@media (max-width: 599px), (max-height: 499px) {
		.details-panel {
			width: auto;
			max-height: 45dvh;
			gap: 0;
			padding: 0;
			padding-left: env(safe-area-inset-left, 0px);
			padding-right: env(safe-area-inset-right, 0px);
			box-shadow: 0 1px 0 var(--border);
		}

		.heading {
			position: absolute;
			width: 1px;
			height: 1px;
			margin: -1px;
			padding: 0;
			overflow: hidden;
			clip-path: inset(50%);
			white-space: nowrap;
			border: 0;
		}

		.toggle {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			width: 100%;
			min-height: var(--touch-target);
			padding: 0 16px;
			border: none;
			background: transparent;
			color: var(--text);
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
		}

		.chevron {
			transition: transform 150ms ease;
		}

		.expanded .chevron {
			transform: rotate(180deg);
		}

		.content {
			display: none;
			padding: 0 16px 16px;
		}

		.expanded .content {
			display: flex;
		}
	}
</style>
