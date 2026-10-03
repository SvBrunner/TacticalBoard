<!--
@component
The app header: situation title, undo/redo, load/export and theme toggle.
On phones the buttons become icon-only; their text stays as accessible name.
-->
<script lang="ts">
	import { theme, toggleTheme } from "$lib/theme";
	import { notifications } from "$lib/debug/Notifications";

	interface Props {
		title: string;
		onExport: () => void;
		onLoadFile: (file: File) => void;
		canUndo: boolean;
		canRedo: boolean;
		onUndo: () => void;
		onRedo: () => void;
	}

	let { title, onExport, onLoadFile, canUndo, canRedo, onUndo, onRedo }: Props = $props();

	let fileInput: HTMLInputElement;

	function handleToggleTheme() {
		toggleTheme();
		notifications.notify(`Theme: ${$theme}`);
	}

	// Guarded as well as `disabled`, so a synthetic click on a disabled button can't trigger it.
	function handleUndo() {
		if (canUndo) onUndo();
	}

	function handleRedo() {
		if (canRedo) onRedo();
	}

	function openFilePicker() {
		notifications.notify("Opening file picker…");
		fileInput.click();
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onLoadFile(file);
		}
		input.value = "";
	}
</script>

<header class="topbar">
	<div class="badge" aria-hidden="true">
		<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 3v18M3 12h18" />
		</svg>
	</div>

	<h1 class="title">{title}</h1>

	<div class="actions">
		<div class="history" role="group" aria-label="History">
			<button type="button" class="btn icon" onclick={handleUndo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
					<path d="M9 14L4 9l5-5" />
					<path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
				</svg>
			</button>
			<button type="button" class="btn icon" onclick={handleRedo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
					<path d="M15 14l5-5-5-5" />
					<path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
				</svg>
			</button>
		</div>

		<div class="divider" aria-hidden="true"></div>

		<button type="button" class="btn ghost" title="Load" onclick={openFilePicker}>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M12 15V3M7 8l5-5 5 5" />
				<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
			</svg>
			<span class="label">Load</span>
		</button>
		<input bind:this={fileInput} type="file" accept=".json" class="hidden-input" onchange={handleFileChange} />

		<button type="button" class="btn primary" title="Export JSON" onclick={onExport}>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M12 3v12M7 10l5 5 5-5" />
				<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
			</svg>
			<span class="label">Export JSON</span>
		</button>

		<div class="divider" aria-hidden="true"></div>

		<button type="button" class="btn icon" onclick={handleToggleTheme} aria-label="Toggle theme" title="Toggle theme">
			{#if $theme === "dark"}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" /></svg>
			{:else}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true" focusable="false">
					<circle cx="12" cy="12" r="4.5" />
					<path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
				</svg>
			{/if}
		</button>
	</div>
</header>

<style>
	.topbar {
		height: 64px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 0 20px;
		padding-left: calc(20px + env(safe-area-inset-left, 0px));
		padding-right: calc(20px + env(safe-area-inset-right, 0px));
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
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.2;
		color: var(--text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 16px;
		flex-shrink: 0;
	}

	.btn {
		border: none;
		cursor: pointer;
		font-family: inherit;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: var(--touch-target);
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
		width: var(--touch-target);
		padding: 0;
		background: var(--bg-app);
		color: var(--text);
	}

	.btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.history {
		display: flex;
		gap: 8px;
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

	@media (max-width: 1023px) {
		.topbar,
		.actions {
			gap: 8px;
		}

		.topbar {
			padding-left: calc(16px + env(safe-area-inset-left, 0px));
			padding-right: calc(16px + env(safe-area-inset-right, 0px));
		}
	}

	/* Phones: compact header, icon-only buttons (the label stays the accessible name). */
	@media (max-width: 599px), (max-height: 499px) {
		.topbar {
			height: 48px;
			gap: 8px;
			padding-left: calc(8px + env(safe-area-inset-left, 0px));
			padding-right: calc(8px + env(safe-area-inset-right, 0px));
		}

		.badge {
			width: 28px;
			height: 28px;
		}

		.title {
			font-size: 14px;
		}

		.actions,
		.history {
			gap: 4px;
		}

		.divider {
			display: none;
		}

		.btn.ghost,
		.btn.primary {
			width: var(--touch-target);
			padding: 0;
		}

		.label {
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
	}
</style>
