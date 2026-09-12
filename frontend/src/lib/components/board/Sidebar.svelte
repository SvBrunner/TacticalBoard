<script lang="ts">
	import type { ElementType, SidebarElementType } from "./Board";
	import { notifications } from "$lib/debug/Notifications";

	export let activeTool: "Move" | ElementType;
	export let selectedColor: string;

	const colors = [
		{ name: "Team A", value: "oklch(62% 0.16 230)" },
		{ name: "Team B", value: "oklch(64% 0.16 32)" },
		{ name: "Team C", value: "oklch(64% 0.14 150)" },
		{ name: "Team D", value: "oklch(78% 0.14 90)" },
	];

	const types: { type: SidebarElementType; name: string; disabled?: boolean }[] = [
		{ type: "Player", name: "Player" },
		{ type: "Ball", name: "Ball" },
		// Pass/Run/Shot are line elements (start -> end) and need a different
		// placement interaction than the point types below; not implemented yet.
		{ type: "Pass", name: "Pass", disabled: true },
		{ type: "Run", name: "Run", disabled: true },
		{ type: "Shot", name: "Shot", disabled: true },
		{ type: "Rectangle", name: "Rectangle" },
		{ type: "Triangle", name: "Triangle" },
		{ type: "Circle", name: "Circle" },
	];

	function selectTool(t: { type: SidebarElementType; disabled?: boolean }) {
		if (!t.disabled) {
			activeTool = t.type as ElementType;
			notifications.notify(`Tool: ${activeTool}`);
		}
	}
</script>

<div class="sidebar">
	<button
		class="tool-btn move-btn"
		class:active={activeTool === "Move"}
		aria-pressed={activeTool === "Move"}
		on:click={() => {
			activeTool = "Move";
			notifications.notify("Tool: Move");
		}}
	>
		<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"
			><path d="M4 3.5l16 6.6-6.4 2-2 6.4z" /></svg
		>
		<span class="label">Move</span>
	</button>

	<div class="section">
		<div class="section-title">Elements</div>
		<div class="grid">
			{#each types as t (t.type)}
				<button
					class="tool-btn type-btn"
					class:active={activeTool === t.type}
					aria-pressed={activeTool === t.type}
					disabled={t.disabled}
					on:click={() => selectTool(t)}
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
						{#if t.type === "Player"}
							<circle cx="12" cy="8" r="3.2" />
							<path d="M5.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
						{:else if t.type === "Ball"}
							<circle cx="12" cy="12" r="8" stroke-width="1.7" />
							<path d="M9 5.5Q13 12 9 18.5M15 5.5Q11 12 15 18.5" stroke-width="1.7" />
						{:else if t.type === "Pass"}
							<line x1="5" y1="18" x2="17" y2="7" stroke-dasharray="3 3" stroke-linecap="round" />
							<path d="M12 7h5v5" stroke-linecap="round" stroke-linejoin="round" />
						{:else if t.type === "Run"}
							<path d="M5 18Q9 6 18 8" stroke-linecap="round" />
							<path d="M13 6.5l5 1.2-1.4 4.9" stroke-linecap="round" stroke-linejoin="round" />
						{:else if t.type === "Shot"}
							<line x1="4" y1="15" x2="14" y2="5" stroke-width="1.6" stroke-linecap="round" />
							<line x1="8" y1="19" x2="18" y2="9" stroke-width="1.6" stroke-linecap="round" />
							<path d="M12 5h6v6" stroke-width="1.6" stroke-linecap="round" />
						{:else if t.type === "Rectangle"}
							<rect x="4.5" y="6.5" width="15" height="11" rx="1.5" />
						{:else if t.type === "Triangle"}
							<path d="M12 4.5l8.5 15h-17z" stroke-linejoin="round" />
						{:else if t.type === "Circle"}
							<circle cx="12" cy="12" r="7.5" />
						{/if}
					</svg>
					<span class="label">{t.name}</span>
				</button>
			{/each}
		</div>
	</div>

	{#if activeTool === "Player"}
		<div class="section">
			<div class="section-title">Player color</div>
			<div class="swatches">
				{#each colors as c (c.value)}
					<button
						class="swatch"
						class:selected={selectedColor === c.value}
						aria-pressed={selectedColor === c.value}
						style="background: {c.value}"
						aria-label={c.name}
						on:click={() => {
							selectedColor = c.value;
							notifications.notify(`Player color: ${c.name}`);
						}}
					></button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.sidebar {
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

	.tool-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.tool-btn.active {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.move-btn {
		width: 100%;
		height: 44px;
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
		margin-bottom: 10px;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.type-btn {
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
		width: 40px;
		height: 40px;
		box-shadow: 0 0 0 2px transparent;
	}

	.swatch.selected {
		box-shadow: 0 0 0 2px var(--accent);
	}
</style>
