<!--
@component
Edit popover for one board element: change its type (within its family:
point types or arrow types), its color and, for players, the position
label; for arrows remove the active bend or straighten it; or delete the
element. A non-modal dialog anchored next to the element on larger
screens; a bottom sheet on phones (pure CSS, see the media query).
-->
<script lang="ts">
	import type { ScreenRect } from "$lib/board/BoardViewport";
	import { ArrowElement } from "$lib/model/elements/ArrowElement";
	import type { BoardElement } from "$lib/model/elements/BoardElement";
	import { PointElement } from "$lib/model/elements/PointElement";
	import { PositionCatalog } from "$lib/model/positions/PositionCatalog";
	import { t } from "$lib/i18n";
	import { elementCatalog, type ElementKind } from "../ElementCatalog";
	import ElementIcon from "../ElementIcon.svelte";
	import type { ElementEditActions } from "./ElementEditActions";
	import { PopoverPlacement } from "./PopoverPlacement";
	import PositionPicker from "./PositionPicker.svelte";

	interface Props {
		/** The element being edited; `null` hides the popover. */
		element: BoardElement | null;
		/** On-screen bounds of the element (viewport CSS px). */
		anchor: ScreenRect | null;
		/** The active bend of the arrow being edited (offered for removal), if any. */
		bendIndex?: number | null;
		actions: ElementEditActions;
		onClose: () => void;
		/** "Edit shape" for an arrow: hide the popover but keep the arrow selected (its handles stay usable). */
		onEditShape?: () => void;
		placement?: PopoverPlacement;
		/** Predefined position labels offered for players (the situation's sport). */
		positions?: PositionCatalog;
	}

	let {
		element,
		anchor,
		bendIndex = null,
		actions,
		onClose,
		onEditShape,
		placement = new PopoverPlacement(),
		positions = PositionCatalog.forSport("floorball"),
	}: Props = $props();

	const headingId = "element-edit-popover-heading";

	let dialog: HTMLDialogElement | undefined = $state();
	let size = $state({ width: 0, height: 0 });
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);

	const position = $derived(
		anchor ? placement.place(anchor, size, { width: viewportWidth, height: viewportHeight }) : null,
	);
	const openFor = $derived(element?.id ?? null);
	const arrow = $derived(element instanceof ArrowElement ? element : null);

	const kinds = $derived(element ? elementCatalog.kindsLike(element.type) : []);
	const colorLegend = $derived(element?.type === "Player" ? $t.popover.playerColor : $t.popover.color);
	const activeBend = $derived(arrow && bendIndex !== null && bendIndex < arrow.bends.length ? bendIndex : null);

	// Measure after every content change (e.g. the position picker or a bend button appearing).
	$effect(() => {
		void element?.type;
		void arrow?.bends.length;
		void activeBend;
		void anchor;
		if (dialog) {
			size = { width: dialog.offsetWidth, height: dialog.offsetHeight };
		}
	});

	// Move focus into the dialog whenever it opens for an element.
	$effect(() => {
		if (openFor !== null && dialog) {
			dialog.focus();
		}
	});

	function pickType(kind: ElementKind) {
		if (element) {
			actions.changeType(element.id, kind.type);
		}
	}

	function removeBend() {
		if (arrow && activeBend !== null) {
			actions.removeBend(arrow.id, activeBend);
		}
	}

	function straighten() {
		if (arrow) {
			actions.straightenArrow(arrow.id);
		}
	}

	function pickColor(color: string) {
		if (element) {
			actions.changeColor(element.id, color);
		}
	}

	function remove() {
		if (element) {
			actions.removeElement(element.id);
		}
		onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		}
	}
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

{#if element}
	<dialog
		bind:this={dialog}
		open
		class="popover"
		aria-labelledby={headingId}
		tabindex="-1"
		data-side={position?.side}
		style:--anchor-x={position ? `${position.x}px` : null}
		style:--anchor-y={position ? `${position.y}px` : null}
		onkeydown={handleKeydown}
	>
		<header class="header">
			<h2 id={headingId} class="title">{arrow ? $t.popover.editArrow : $t.popover.editMarker}</h2>
			<button type="button" class="icon-btn" onclick={onClose} aria-label={$t.common.close}>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"
					><path d="M6 6l12 12M18 6L6 18" /></svg
				>
			</button>
		</header>

		<fieldset>
			<legend class="section-title">{$t.popover.type}</legend>
			<ul class="grid">
				{#each kinds as kind (kind.type)}
					<li>
						<button
							type="button"
							class="type-btn"
							class:active={element.type === kind.type}
							aria-pressed={element.type === kind.type}
							onclick={() => pickType(kind)}
						>
							<ElementIcon type={kind.type} size={17} />
							<span class="label">{$t.elements[kind.type]}</span>
						</button>
					</li>
				{/each}
			</ul>
		</fieldset>

		<fieldset>
			<legend class="section-title">{colorLegend}</legend>
			<ul class="swatches">
				{#each elementCatalog.colors as color (color.value)}
					<li>
						<button
							type="button"
							class="swatch"
							class:selected={element.color === color.value}
							aria-pressed={element.color === color.value}
							aria-label={$t.colors[color.id]}
							title={$t.colors[color.id]}
							style:background={color.value}
							onclick={() => pickColor(color.value)}
						></button>
					</li>
				{/each}
			</ul>
		</fieldset>

		{#if element instanceof PointElement && element.type === "Player"}
			<PositionPicker {element} {positions} {actions} />
		{/if}

		{#if arrow}
			<fieldset>
				<legend class="section-title">{$t.popover.bends}</legend>
				<p class="hint">{$t.popover.bendsHint}</p>
				{#if onEditShape || activeBend !== null || arrow.bends.length > 0}
					<ul class="bend-actions">
						{#if onEditShape}
							<li>
								<button type="button" class="action-btn" onclick={onEditShape}>{$t.popover.editShape}</button>
							</li>
						{/if}
						{#if activeBend !== null}
							<li>
								<button type="button" class="action-btn" onclick={removeBend}>{$t.popover.removeBend}</button>
							</li>
						{/if}
						{#if arrow.bends.length > 0}
							<li>
								<button type="button" class="action-btn" onclick={straighten}>{$t.popover.straighten}</button>
							</li>
						{/if}
					</ul>
				{/if}
			</fieldset>
		{/if}

		<button type="button" class="delete-btn" onclick={remove}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
			</svg>
			{arrow ? $t.popover.deleteArrow : $t.popover.deleteMarker}
		</button>
	</dialog>
{/if}

<style>
	.popover {
		position: fixed;
		inset: auto;
		left: var(--anchor-x, 8px);
		top: var(--anchor-y, 8px);
		margin: 0;
		width: 252px;
		max-height: calc(100dvh - 16px);
		overflow-y: auto;
		background: var(--bg-surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		z-index: 10;
	}

	/* The dialog itself only receives focus programmatically (on open); its controls show focus. */
	.popover:focus,
	.popover:focus-visible {
		outline: none;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.icon-btn {
		width: var(--touch-target);
		height: var(--touch-target);
		margin: -8px -8px -8px 0;
		border-radius: var(--radius-sm);
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	fieldset {
		border: none;
		margin: 0;
		padding: 0;
		min-width: 0;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
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

	.grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.type-btn {
		width: 100%;
		border: 1px solid var(--border);
		background: var(--bg-surface);
		cursor: pointer;
		height: 52px;
		border-radius: var(--radius-sm);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		color: var(--text);
		font-family: inherit;
	}

	.type-btn.active {
		background: var(--accent);
		color: var(--accent-contrast);
		border-color: var(--accent);
	}

	.type-btn .label {
		font-size: 9px;
		font-weight: 500;
	}

	.swatches {
		display: grid;
		grid-template-columns: repeat(auto-fill, var(--touch-target));
		gap: 8px;
	}

	.hint {
		margin: 0 0 10px;
		font-size: 11px;
		line-height: 1.4;
		color: var(--text-muted);
	}

	.bend-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.action-btn {
		min-height: var(--touch-target);
		padding: 0 14px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--bg-surface);
		color: var(--text);
		font-family: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
	}

	.swatch {
		border: none;
		cursor: pointer;
		border-radius: 50%;
		width: var(--touch-target);
		height: var(--touch-target);
		box-shadow: 0 0 0 2px transparent;
	}

	.swatch.selected {
		box-shadow:
			0 0 0 2px var(--bg-surface),
			0 0 0 4px var(--accent);
	}

	.delete-btn {
		width: 100%;
		height: var(--touch-target);
		border-radius: var(--radius-sm);
		background: transparent;
		border: 1px solid var(--border);
		color: var(--danger);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
	}

	/* Phones: a bottom sheet instead of an anchored popover. */
	@media (max-width: 599px), (max-height: 499px) {
		.popover {
			left: 0;
			right: 0;
			top: auto;
			bottom: 0;
			width: auto;
			max-height: 75dvh;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			border-bottom: none;
			gap: 12px;
			padding: 12px calc(16px + env(safe-area-inset-right, 0px)) calc(16px + env(safe-area-inset-bottom, 0px))
				calc(16px + env(safe-area-inset-left, 0px));
		}

		.grid {
			grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
		}
	}
</style>
