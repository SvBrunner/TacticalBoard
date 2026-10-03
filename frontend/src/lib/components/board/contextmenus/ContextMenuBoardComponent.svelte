<script lang="ts">
	import { situationEditor } from "$lib/editor/SituationEditor";
	import type { ElementType, SidebarElementType } from "$lib/model/elements/ElementType";
	import { notifications } from "$lib/debug/Notifications";

	let pos = { x: 0, y: 0 };
	let showMenu = false;
	let targetId = "";
	let targetType: ElementType = "Player";
	let targetColor = "";

	const colors = [
		{ name: "Team A", value: "oklch(62% 0.16 230)" },
		{ name: "Team B", value: "oklch(64% 0.16 32)" },
		{ name: "Team C", value: "oklch(64% 0.14 150)" },
		{ name: "Team D", value: "oklch(78% 0.14 90)" },
	];

	const types: { type: SidebarElementType; name: string; disabled?: boolean }[] = [
		{ type: "Player", name: "Player" },
		{ type: "Ball", name: "Ball" },
		{ type: "Pass", name: "Pass", disabled: true },
		{ type: "Run", name: "Run", disabled: true },
		{ type: "Shot", name: "Shot", disabled: true },
		{ type: "Rectangle", name: "Rectangle" },
		{ type: "Triangle", name: "Triangle" },
		{ type: "Circle", name: "Circle" },
	];

	export function showRightClickContextMenu(e: any, id: string, type: ElementType, color: string) {
		targetId = id;
		targetType = type;
		targetColor = color;
		showMenu = true;
		pos = { x: e.clientX, y: e.clientY };
	}

	export function onPageClick(_e: any) {
		showMenu = false;
		targetId = "";
	}

	function pickType(t: { type: SidebarElementType; disabled?: boolean }) {
		if (t.disabled) return;
		const type = t.type as ElementType;
		targetType = type;
		situationEditor.changeType(targetId, type);
		notifications.notify(`Changed ${targetId} type to ${type}`);
	}

	function pickColor(color: string) {
		targetColor = color;
		situationEditor.changeColor(targetId, color);
		notifications.notify(`Changed ${targetId} color`);
	}

	function remove() {
		notifications.notify(`Deleted ${targetType} ${targetId}`);
		situationEditor.removeElement(targetId);
		onPageClick(null);
	}
</script>

{#if showMenu}
	<div class="popover" style="top:{pos.y}px; left:{pos.x}px">
		<div class="header">
			<span class="title">Edit marker</span>
			<button class="icon-btn" on:click={() => onPageClick(null)} aria-label="Close">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
					><path d="M6 6l12 12M18 6L6 18" /></svg
				>
			</button>
		</div>

		<div>
			<div class="section-title">Type</div>
			<div class="grid">
				{#each types as t (t.type)}
					<button
						class="type-btn"
						class:active={targetType === t.type}
						aria-pressed={targetType === t.type}
						disabled={t.disabled}
						on:click={() => pickType(t)}
					>
						<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
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

		{#if targetType === "Player"}
			<div>
				<div class="section-title">Player color</div>
				<div class="swatches">
					{#each colors as c (c.value)}
						<button
							class="swatch"
							class:selected={targetColor === c.value}
							aria-pressed={targetColor === c.value}
							style="background: {c.value}"
							aria-label={c.name}
							on:click={() => pickColor(c.value)}
						></button>
					{/each}
				</div>
			</div>
		{/if}

		<button class="delete-btn" on:click={remove}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
				<path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
			</svg>
			Delete marker
		</button>
	</div>
{/if}

<style>
	.popover {
		position: fixed;
		width: 236px;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
		z-index: 10;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.title {
		font-size: 13px;
		font-weight: 600;
		color: var(--text);
	}

	.icon-btn {
		width: 32px;
		height: 32px;
		border-radius: 7px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.type-btn {
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
	}

	.type-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
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
		display: flex;
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

	.delete-btn {
		width: 100%;
		height: 44px;
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
</style>
