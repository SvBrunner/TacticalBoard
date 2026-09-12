<script lang="ts">
	import { theme, toggleTheme } from "$lib/theme";
	import { notifications } from "$lib/debug/Notifications";

	function handleToggleTheme() {
		toggleTheme();
		notifications.notify(`Theme: ${$theme === "dark" ? "light" : "dark"}`);
	}

	export let title: string;
	export let onExport: () => void;
	export let onLoadFile: (file: File) => void;

	let fileInput: HTMLInputElement;

	function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			onLoadFile(file);
		}
		(e.target as HTMLInputElement).value = "";
	}
</script>

<div class="topbar">
	<div class="badge">
		<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 3v18M3 12h18" />
		</svg>
	</div>

	<div class="title">
		<div class="name">{title}</div>
	</div>

	<div class="spacer"></div>

	<button
		class="btn ghost"
		on:click={() => {
			notifications.notify("Opening file picker…");
			fileInput.click();
		}}
	>
		<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
			<path d="M12 15V3M7 8l5-5 5 5" />
			<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
		</svg>
		<span>Load</span>
	</button>
	<input bind:this={fileInput} type="file" accept=".json" class="hidden-input" on:change={handleFileChange} />

	<button class="btn primary" on:click={onExport}>
		<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
			<path d="M12 3v12M7 10l5 5 5-5" />
			<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
		</svg>
		<span>Export JSON</span>
	</button>

	<div class="divider"></div>

	<button class="btn icon" on:click={handleToggleTheme} aria-label="Toggle theme">
		{#if $theme === "dark"}
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" /></svg>
		{:else}
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">
				<circle cx="12" cy="12" r="4.5" />
				<path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
			</svg>
		{/if}
	</button>
</div>

<style>
	.topbar {
		height: 64px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 20px;
		background: var(--bg-surface);
		position: relative;
		z-index: 2;
		box-shadow:
			0 1px 0 var(--border),
			0 6px 16px -10px oklch(20% 0.02 260 / 0.35);
	}

	.badge {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-sm);
		background: var(--accent);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.title {
		display: flex;
		flex-direction: column;
		line-height: 1.2;
	}

	.name {
		font-size: 15px;
		font-weight: 600;
		color: var(--text);
	}

	.spacer {
		flex-grow: 1;
	}

	.btn {
		border: none;
		cursor: pointer;
		font-family: inherit;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 16px;
		border-radius: var(--radius-sm);
		font-size: 14px;
		font-weight: 500;
	}

	.btn.ghost {
		background: transparent;
		color: var(--text);
	}

	.btn.primary {
		background: var(--accent);
		color: var(--accent-contrast);
		font-weight: 600;
	}

	.btn.icon {
		width: 44px;
		padding: 0;
		background: var(--bg-app);
		color: var(--text);
	}

	.divider {
		width: 1px;
		height: 24px;
		background: var(--border);
		margin: 0 4px;
	}

	.hidden-input {
		display: none;
	}
</style>
