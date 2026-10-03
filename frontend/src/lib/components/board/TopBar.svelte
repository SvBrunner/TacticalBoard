<!--
@component
The editor header: the app badge (a link back to the start page), situation
title, undo/redo, new/load, the export choice and theme toggle. On phones
the buttons become icon-only; their text stays as accessible name.

Export is a disclosure button with two choices below it: "Situation file
(JSON)" and "Animated GIF". The choices close again after a choice, with
Escape (focus back on Export), or when focus or a press goes elsewhere.
-->
<script lang="ts">
	import { theme, toggleTheme } from "$lib/theme";
	import { notifications } from "$lib/debug/Notifications";

	interface Props {
		title: string;
		/** The badge was activated: go back to the start page (the owner checks for unsaved changes). */
		onHome: () => void;
		/** Start a new situation (the owner checks for unsaved changes). */
		onNew: () => void;
		/** Export the situation as a JSON file. */
		onExportJson: () => void;
		/** Export the frames as an animated GIF (opens the export dialog). */
		onExportAnimation: () => void;
		onLoadFile: (file: File) => void;
		canUndo: boolean;
		canRedo: boolean;
		onUndo: () => void;
		onRedo: () => void;
	}

	let { title, onHome, onNew, onExportJson, onExportAnimation, onLoadFile, canUndo, canRedo, onUndo, onRedo }: Props =
		$props();

	const uid = $props.id();
	let fileInput: HTMLInputElement;
	let exportMenu: HTMLElement;
	let exportToggle: HTMLButtonElement;
	let exportOpen = $state(false);

	function toggleExportMenu() {
		exportOpen = !exportOpen;
	}

	function chooseExport(run: () => void) {
		exportOpen = false;
		exportToggle.focus();
		run();
	}

	function handleExportKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && exportOpen) {
			event.preventDefault();
			event.stopPropagation();
			exportOpen = false;
			exportToggle.focus();
		}
	}

	function handleExportFocusOut(event: FocusEvent) {
		const next = event.relatedTarget;
		if (next instanceof Node && exportMenu.contains(next)) {
			return;
		}
		// Focus left the menu (or went nowhere, e.g. a click on the page).
		if (next !== null) {
			exportOpen = false;
		}
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (exportOpen && !(event.target instanceof Node && exportMenu.contains(event.target))) {
			exportOpen = false;
		}
	}

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

	// A real link (works without the handler, e.g. opened in a new tab); a
	// plain activation goes through `onHome`, which asks about unsaved changes.
	function handleHome(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return;
		}
		event.preventDefault();
		onHome();
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

<svelte:window onpointerdown={handleWindowPointerDown} />

<header class="topbar">
	<a class="badge" href="/" aria-label="Start page" title="Start page" onclick={handleHome}>
		<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
			<circle cx="12" cy="12" r="9" />
			<path d="M12 3v18M3 12h18" />
		</svg>
	</a>

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

		<button type="button" class="btn ghost" title="New situation" onclick={onNew}>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M12 5v14M5 12h14" />
			</svg>
			<span class="label">New</span>
		</button>

		<button type="button" class="btn ghost" title="Load" onclick={openFilePicker}>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
				<path d="M12 15V3M7 8l5-5 5 5" />
				<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
			</svg>
			<span class="label">Load</span>
		</button>
		<input bind:this={fileInput} type="file" accept=".json" class="hidden-input" onchange={handleFileChange} />

		<div class="export-menu" bind:this={exportMenu} onfocusout={handleExportFocusOut}>
			<button
				bind:this={exportToggle}
				type="button"
				class="btn primary"
				title="Export"
				aria-expanded={exportOpen}
				aria-controls="{uid}-export-options"
				onclick={toggleExportMenu}
				onkeydown={handleExportKeydown}
			>
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
					<path d="M12 3v12M7 10l5 5 5-5" />
					<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
				</svg>
				<span class="label">Export</span>
				<svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>
			<ul id="{uid}-export-options" class="export-options" aria-label="Export as" hidden={!exportOpen}>
				<li>
					<button type="button" class="export-option" onclick={() => chooseExport(onExportJson)} onkeydown={handleExportKeydown}>Situation file (JSON)</button>
				</li>
				<li>
					<button type="button" class="export-option" onclick={() => chooseExport(onExportAnimation)} onkeydown={handleExportKeydown}>Animated GIF</button>
				</li>
			</ul>
		</div>

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

	/* The visible badge stays 34 px; the link's hit area is the 44 px touch target around it. */
	.badge {
		width: var(--touch-target);
		height: var(--touch-target);
		margin: -5px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-sm);
		background: var(--accent);
		background-clip: content-box;
		padding: 5px;
		box-sizing: border-box;
	}

	.badge:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
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

	.export-menu {
		position: relative;
	}

	.btn.primary[aria-expanded="true"] .chevron {
		transform: rotate(180deg);
	}

	.export-options {
		position: absolute;
		top: calc(100% + 6px);
		right: 0;
		z-index: 3;
		min-width: 220px;
		margin: 0;
		padding: 6px;
		list-style: none;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow);
	}

	.export-option {
		width: 100%;
		min-height: var(--touch-target);
		padding: 0 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 14px;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	.export-option:hover,
	.export-option:focus-visible {
		background: var(--bg-app);
	}

	.export-option:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: -2px;
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
			padding: 8px;
			margin: -8px -2px;
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

		.chevron {
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
