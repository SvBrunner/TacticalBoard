<!--
@component
The tool panel: Move, the element tools (placing players, the ball and
markers; drawing Pass/Run/Shot arrows), and (with the Player tool) the
player color. A side panel on desktop/tablet, a scrollable bottom
bar on portrait phones and a narrow left rail on landscape phones. `disabled` (during playback) disables every
button; the active tool stays marked.
-->
<script lang="ts">
	import type { Tool } from "$lib/board/ToolState";
	import { t } from "$lib/i18n";
	import { elementCatalog } from "./ElementCatalog";
	import ElementIcon from "./ElementIcon.svelte";

	interface Props {
		activeTool: Tool;
		playerColor: string;
		onSelectTool: (tool: Tool) => void;
		onSelectPlayerColor: (color: string) => void;
		/** No tool or color can be chosen (e.g. during playback). */
		disabled?: boolean;
	}

	let { activeTool, playerColor, onSelectTool, onSelectPlayerColor, disabled = false }: Props = $props();

	// Guarded as well as `disabled`, so a synthetic click on a disabled button can't trigger it.
	function selectTool(tool: Tool) {
		if (!disabled) onSelectTool(tool);
	}

	function selectPlayerColor(color: string) {
		if (!disabled) onSelectPlayerColor(color);
	}
</script>

<aside class="tool-panel" aria-label={$t.tools.panel}>
	<div class="tools-row">
		<button
			type="button"
			class="tool-btn move-btn"
			class:active={activeTool === "Move"}
			aria-pressed={activeTool === "Move"}
			title={$t.tools.move}
			{disabled}
			onclick={() => selectTool("Move")}
		>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"
				><path d="M4 3.5l16 6.6-6.4 2-2 6.4z" /></svg
			>
			<span class="label">{$t.tools.move}</span>
		</button>

		<section class="section" aria-labelledby="tool-panel-elements">
			<h2 id="tool-panel-elements" class="section-title">{$t.tools.elements}</h2>
			<ul class="grid">
				{#each elementCatalog.kinds as kind (kind.type)}
					<li>
						<button
							type="button"
							class="tool-btn type-btn"
							class:active={activeTool === kind.type}
							aria-pressed={activeTool === kind.type}
							title={$t.elements[kind.type]}
							{disabled}
							onclick={() => selectTool(kind.type)}
						>
							<ElementIcon type={kind.type} />
							<span class="label">{$t.elements[kind.type]}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	</div>

	{#if activeTool === "Player"}
		<section class="section colors" aria-labelledby="tool-panel-colors">
			<h2 id="tool-panel-colors" class="section-title">{$t.tools.playerColor}</h2>
			<ul class="swatches">
				{#each elementCatalog.playerColors as color (color.value)}
					<li>
						<button
							type="button"
							class="swatch"
							class:selected={playerColor === color.value}
							aria-pressed={playerColor === color.value}
							aria-label={$t.colors[color.id]}
							title={$t.colors[color.id]}
							style:background={color.value}
							{disabled}
							onclick={() => selectPlayerColor(color.value)}
						></button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</aside>

<style>
	.tool-panel {
		width: 184px;
		flex-shrink: 0;
		background: var(--bg-surface);
		position: relative;
		z-index: 1;
		box-shadow:
			1px 0 0 var(--border),
			6px 0 16px -12px oklch(20% 0.02 260 / 0.3);
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
		overflow-y: auto;
	}

	.tools-row {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.tool-btn {
		border: none;
		cursor: pointer;
		font-family: inherit;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-app);
		color: var(--text);
		border-radius: var(--radius-sm);
	}

	.tool-btn.active {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.move-btn {
		width: 100%;
		height: var(--touch-target);
		gap: 10px;
	}

	.move-btn .label {
		font-size: 13px;
		font-weight: 600;
	}

	.section-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
		margin: 0 0 10px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.type-btn {
		width: 100%;
		border: 1px solid var(--border);
		height: 60px;
		flex-direction: column;
		gap: 4px;
	}

	.type-btn .label {
		font-size: 10px;
		font-weight: 500;
	}

	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.swatch {
		border: none;
		cursor: pointer;
		border-radius: 50%;
		width: var(--touch-target);
		height: var(--touch-target);
		box-shadow: 0 0 0 2px transparent;
	}

	.tool-btn:disabled,
	.swatch:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.swatch.selected {
		box-shadow: 0 0 0 2px var(--accent);
	}

	/* Phones: icon-only tools; labels and headings stay available to assistive technology. */
	@media (max-width: 599px), (max-height: 499px) {
		.label,
		.section-title {
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

		.move-btn,
		.type-btn {
			width: 48px;
			height: 48px;
			flex-shrink: 0;
		}
	}

	/* Phone portrait: horizontally scrollable bottom bar. */
	@media (max-width: 599px) {
		.tool-panel {
			width: 100%;
			gap: 8px;
			padding: 8px 8px calc(8px + env(safe-area-inset-bottom, 0px));
			padding-left: calc(8px + env(safe-area-inset-left, 0px));
			padding-right: calc(8px + env(safe-area-inset-right, 0px));
			overflow: visible;
			box-shadow:
				0 -1px 0 var(--border),
				0 -6px 16px -12px oklch(20% 0.02 260 / 0.3);
		}

		.tools-row {
			flex-direction: row;
			gap: 8px;
			overflow-x: auto;
			overscroll-behavior-x: contain;
			scrollbar-width: none;
		}

		.grid {
			display: flex;
			gap: 8px;
		}

		.swatches {
			flex-wrap: nowrap;
			gap: 8px;
			overflow-x: auto;
		}
	}

	/* Phone landscape: narrow left rail. */
	@media (max-height: 499px) and (min-width: 600px) {
		.tool-panel {
			width: calc(64px + env(safe-area-inset-left, 0px));
			gap: 8px;
			padding: 8px;
			padding-left: calc(8px + env(safe-area-inset-left, 0px));
			padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
			align-items: center;
		}

		.tools-row {
			gap: 8px;
			align-items: center;
		}

		.grid {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.swatches {
			flex-direction: column;
			flex-wrap: nowrap;
			gap: 8px;
		}
	}
</style>
